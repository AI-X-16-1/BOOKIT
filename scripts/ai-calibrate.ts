/**
 * 채점 기준 잡기 — `npm run ai:calibrate`
 *
 * docs/prompts.md "Test set (day 2)" 가 요구하는 작업이다. owner: 강민구
 * 독후감 20건을 #2 → #3 → #4 파이프라인에 통과시키고 무리별 결과를 센다.
 *
 * 판정 기준(docs/prompts.md 마지막 절):
 *   "진짜 읽었지만 뭉뚱그린" 무리가 2건 넘게 실패하면 임계값이 너무 빡빡하다.
 *   심사위원이 데모하다 튕기면 서비스 전체가 고장난 것처럼 보인다.
 *
 * moderate 와 strict 를 한 번에 잰다. 3축 판정만 모델에서 받고 통과 여부는
 * isPass 가 정하므로(grade.ts), 같은 응답으로 두 임계값을 다 계산할 수 있다.
 * 호출을 두 배로 늘릴 이유가 없다.
 *
 * 호출 사이를 15초씩 벌린다. 무료 키(분당 15회)로도 끝까지 돌게 잡은 값이라 60회 남짓에
 * 20분쯤 걸린다. 대회용 유료 키(#29)는 한도가 높으니 급하면 SPACING_MS 를 줄여도 된다.
 */
import { analyzeGaps, buildQuestion, isPass, LlmError } from "@/modules/ai";
import { GRADING_SYSTEM, gradingUser } from "@/modules/ai/server/prompts";
import { gradeSchema } from "@/modules/ai/schema";
import { callJson } from "@/modules/ai/server/llm";
import type { Gap, GradeAxes } from "@/shared/types";

import {
  TEST_REVIEWS,
  type TestCategory,
  type TestReview,
} from "./fixtures/test-reviews";

const SPACING_MS = 15_000;
const RATE_LIMIT_WAIT_MS = 65_000;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function paced<T>(label: string, run: () => Promise<T>): Promise<T> {
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const value = await run();
      await sleep(SPACING_MS);
      return value;
    } catch (error) {
      if (!(error instanceof LlmError) || error.kind !== "rate_limited") throw error;
      process.stdout.write(` [한도, ${RATE_LIMIT_WAIT_MS / 1000}s 대기 ${attempt}/3]`);
      await sleep(RATE_LIMIT_WAIT_MS);
    }
  }
  throw new LlmError("rate_limited", `[${label}] 요청 한도가 풀리지 않는다.`);
}

/**
 * 채점만 따로 부른다. grade() 는 PASS_THRESHOLD 를 읽어 passed 를 확정하는데,
 * 여기서는 3축 판정만 받아 두 임계값을 각각 계산해야 한다.
 */
async function gradeAxes(
  review: TestReview,
  gap: Gap,
  question: string,
  answer: string,
): Promise<GradeAxes> {
  return callJson({
    label: "grading",
    schema: gradeSchema,
    system: GRADING_SYSTEM,
    user: gradingUser(review.body, gap.quote, question, answer, review.book, {
      gradeLevel: review.gradeLevel,
    }),
    maxTokens: 4096,
  });
}

interface Row {
  id: string;
  category: TestCategory;
  gaps: number;
  gapsOk: boolean;
  /** 답변별 결과 */
  answers: {
    label: string;
    expectPass: boolean;
    moderate: boolean;
    strict: boolean;
    axes: GradeAxes;
  }[];
}

async function main() {
  console.log(`model: ${process.env.LLM_MODEL?.trim() || "(미설정)"}`);
  console.log(`독후감 ${TEST_REVIEWS.length}건 · 예상 20분\n`);

  const rows: Row[] = [];

  for (const review of TEST_REVIEWS) {
    process.stdout.write(`${review.id.padEnd(4)} ${review.category.padEnd(15)}`);

    const { gaps } = await paced("gap-analysis", () =>
      analyzeGaps(review.body, review.book, { gradeLevel: review.gradeLevel }),
    );

    const [min, max] = review.expectGaps;
    const gapsOk = gaps.length >= min && gaps.length <= max;
    process.stdout.write(` 빈틈 ${gaps.length}개(기대 ${min}~${max}) ${gapsOk ? "✓" : "✕"}`);

    const row: Row = {
      id: review.id,
      category: review.category,
      gaps: gaps.length,
      gapsOk,
      answers: [],
    };

    if (gaps.length > 0 && review.answers?.length) {
      const { question } = await paced("question", () =>
        buildQuestion(gaps[0], review.body, review.book, {
          gradeLevel: review.gradeLevel,
        }),
      );

      for (const answer of review.answers) {
        const axes = await paced("grading", () =>
          gradeAxes(review, gaps[0], question, answer.text),
        );
        row.answers.push({
          label: answer.label,
          expectPass: answer.expectPass,
          moderate: isPass(axes, "moderate"),
          strict: isPass(axes, "strict"),
          axes,
        });
      }
    }

    rows.push(row);
    console.log("");
  }

  report(rows);
}

function report(rows: Row[]) {
  const line = "─".repeat(64);
  console.log(`\n${line}\n결과\n${line}`);

  const categories: TestCategory[] = [
    "well_written",
    "vague_but_read",
    "not_read",
    "ghostwritten",
  ];

  for (const category of categories) {
    const group = rows.filter((row) => row.category === category);
    const gapsOk = group.filter((row) => row.gapsOk).length;
    console.log(`\n▸ ${category}  (${group.length}건)`);
    console.log(`   빈틈 개수 기대 범위 안: ${gapsOk}/${group.length}`);

    for (const threshold of ["moderate", "strict"] as const) {
      const answers = group.flatMap((row) => row.answers);
      const correct = answers.filter(
        (answer) => answer[threshold] === answer.expectPass,
      ).length;
      console.log(
        `   ${threshold.padEnd(8)} 기대와 일치: ${correct}/${answers.length}`,
      );
    }

    // 대필 무리는 style_consistency 가 걸렸는지가 핵심이다.
    if (category === "ghostwritten") {
      const answers = group.flatMap((row) => row.answers);
      const shifted = answers.filter(
        (answer) => answer.axes.style_consistency === "shifted",
      ).length;
      console.log(`   style_consistency=shifted: ${shifted}/${answers.length}  ← 대필 판별`);
    }
  }

  console.log(`\n${line}\n판정 — docs/prompts.md 기준\n${line}`);

  for (const threshold of ["moderate", "strict"] as const) {
    const vague = rows
      .filter((row) => row.category === "vague_but_read")
      .flatMap((row) => row.answers)
      .filter((answer) => answer.expectPass);
    const failed = vague.filter((answer) => !answer[threshold]);

    const verdict =
      failed.length <= 2
        ? "OK"
        : "너무 빡빡하다 — 심사위원이 데모하다 튕긴다";
    console.log(
      `${threshold.padEnd(8)} "진짜 읽었지만 뭉뚱그림" 통과해야 할 답변 중 실패 ${failed.length}/${vague.length}  → ${verdict}`,
    );
    for (const answer of failed) {
      console.log(`         ✕ ${answer.label}`);
    }
  }
}

main().catch((error: unknown) => {
  if (error instanceof LlmError) {
    console.error(`\n✕ [${error.kind}] ${error.message}`);
    process.exitCode = 1;
    return;
  }
  console.error(`\n✕ ${error instanceof Error ? error.stack : String(error)}`);
  process.exitCode = 1;
});
