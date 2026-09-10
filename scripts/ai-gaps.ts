/**
 * 빈틈 분석 + 질문 생성 실호출 검증 — `npm run ai:gaps`
 *
 * 4일차 채점 기준 잡기(독후감 20건)의 축소판이다. 여기서 보는 것은 세 가지.
 *   1. quote 가 독후감 원문과 글자 그대로 일치하는가 (하이라이트가 뜨는가)
 *   2. 잘 쓴 독후감에서 빈틈을 억지로 만들어내지 않는가
 *   3. 재시도 때 이전과 다른 질문이 나오는가 (부정행위 방지)
 */
import type { AnalyzeGaps, BookContext, BuildQuestion } from "@/shared/types";

import { analyzeGaps, buildQuestion, LlmError } from "@/modules/ai";

// shared/types 의 함수 계약과 어긋나면 여기서 컴파일이 깨진다.
const _analyzeContract: AnalyzeGaps = analyzeGaps;
const _questionContract: BuildQuestion = buildQuestion;
void _analyzeContract;
void _questionContract;

const BOOK: BookContext = {
  title: "마당을 나온 암탉",
  author: "황선미",
  tags: ["성장소설", "모험"],
};

interface Sample {
  label: string;
  review: string;
  /** 기대하는 빈틈 개수의 대략적인 범위. 정확한 수를 강제하지는 않는다. */
  expect: string;
}

/**
 * 무료 티어는 분당 요청 한도가 낮다(15 RPM). 배치로 돌리면 반드시 걸린다.
 * 4일차 독후감 20건 테스트도 같은 문제를 겪으므로 여기서 방식을 잡아 둔다.
 *
 * 호출 사이를 벌리고, 그래도 429 가 나면 창이 리셋될 때까지 기다렸다 다시 한다.
 */
const SPACING_MS = 15_000;
const RATE_LIMIT_WAIT_MS = 65_000;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** 호출에 걸린 시간만 잰다 — 페이싱 대기를 빼야 실제 지연을 안다. */
async function paced<T>(
  label: string,
  run: () => Promise<T>,
): Promise<{ value: T; ms: number }> {
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const startedAt = Date.now();
      const value = await run();
      const ms = Date.now() - startedAt;
      await sleep(SPACING_MS);
      return { value, ms };
    } catch (error) {
      if (!(error instanceof LlmError) || error.kind !== "rate_limited") throw error;
      console.log(
        `   … ${label} 요청 한도. ${RATE_LIMIT_WAIT_MS / 1000}초 기다렸다 다시 한다 (${attempt}/3)`,
      );
      await sleep(RATE_LIMIT_WAIT_MS);
    }
  }
  throw new LlmError("rate_limited", `[${label}] 요청 한도가 풀리지 않는다.`);
}

const SAMPLES: Sample[] = [
  {
    label: "감상만 남음",
    review:
      "이 책은 정말 감동적이었다. 읽으면서 눈물이 났다. " +
      "잎싹이 너무 불쌍했다. 여러 가지 일이 많이 일어나서 재미있었다. " +
      "앞으로도 이런 책을 많이 읽고 싶다.",
    expect: "빈틈 2~3개",
  },
  {
    label: "진짜 읽었지만 뭉뚱그림",
    review:
      "잎싹은 마당을 나와서 자유를 찾고 싶어 했다. " +
      "청둥오리 알을 품어서 초록이를 키웠는데, 초록이가 자기랑 다르게 생겨서 " +
      "다른 오리들이 싫어했다. 그래도 잎싹은 끝까지 초록이를 지켰다. " +
      "잎싹은 훌륭한 엄마라고 생각한다.",
    expect: "빈틈 1~2개",
  },
  {
    label: "잘 쓴 독후감",
    review:
      "잎싹이 족제비에게 자기 몸을 내주는 마지막 장면에서 생각이 바뀌었다. " +
      "처음에는 잎싹이 알을 품는 게 욕심이라고 생각했다. 자기 알도 아닌데 " +
      "품겠다고 고집을 부리는 것처럼 보였기 때문이다. " +
      "그런데 초록이가 무리를 따라 날아간 뒤에도 잎싹이 남아 있는 걸 보고, " +
      "잎싹이 원한 건 초록이를 소유하는 게 아니라 한 번쯤 무언가를 " +
      "끝까지 지켜보는 일이었다는 걸 알았다.",
    expect: "빈틈 0~1개",
  },
];

async function main() {
  for (const sample of SAMPLES) {
    console.log(`\n${"─".repeat(58)}\n▸ ${sample.label}  (기대: ${sample.expect})`);

    const analysis = await paced("gap-analysis", () =>
      analyzeGaps(sample.review, BOOK, { gradeLevel: 5 }),
    );
    const { gaps } = analysis.value;
    console.log(`  빈틈 ${gaps.length}개  (${analysis.ms}ms)`);

    for (const gap of gaps) {
      const exact = sample.review.includes(gap.quote);
      console.log(`   ${exact ? "✓" : "✕"} [${gap.type}] "${gap.quote}"`);
      console.log(`      → ${gap.reason}`);
    }

    if (gaps.length === 0) {
      console.log("   질문 없이 통과 처리 대상 (docs/prompts.md §2)");
      continue;
    }

    // 첫 질문
    const first = await paced("question", () =>
      buildQuestion(gaps[0], sample.review, BOOK, { gradeLevel: 5 }),
    );
    console.log(`\n  Q1: ${first.value.question}   (${first.ms}ms)`);

    // 재시도 — 같은 빈틈으로도 다른 질문이 나와야 한다 (CLAUDE.md §6)
    const retry = await paced("question-retry", () =>
      buildQuestion(gaps[0], sample.review, BOOK, {
        gradeLevel: 5,
        avoidQuestions: [first.value.question],
      }),
    );
    const differs = retry.value.question.trim() !== first.value.question.trim();
    console.log(`  Q2: ${retry.value.question}   (${retry.ms}ms)`);
    console.log(`   ${differs ? "✓" : "✕"} 재시도 질문이 이전과 다름`);
  }

  console.log(`\n${"─".repeat(58)}\n검증 종료.`);
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
