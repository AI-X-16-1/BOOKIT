/**
 * 질문 생성(AI #3) 점검 — `npm run ai:question`   owner: 강민구
 *
 * issue #27. 같은 빈틈에 이전 프롬프트와 지금 프롬프트를 나란히 돌려 비교한다.
 *   되풀이  학생 문장을 12자 넘게 그대로 옮겨 적었나 (buildQuestion 이 다시 만드는 기준과 같다)
 *   겹침    "…생각한다라고 했는데" 처럼 조사가 겹쳤나
 * 독후감에 없는 감정을 전제했는지는 기계로 못 가린다 — 질문 원문을 찍으니 눈으로 본다.
 */
import { analyzeGaps, buildQuestion, LlmError } from "@/modules/ai";
import { questionSchema } from "@/modules/ai/schema";
import { callJson } from "@/modules/ai/server/llm";
import { questionUser } from "@/modules/ai/server/prompts";
import { echoesQuote } from "@/modules/ai/server/question";

import { TEST_REVIEWS } from "./fixtures/test-reviews";

/** issue #27 이전의 QUESTION_SYSTEM. 비교 기준으로만 쓴다. */
const PREVIOUS_SYSTEM = `너는 학생이 쓴 독후감을 읽고 되묻는 역할이다.

학생이 쓴 문장을 인용해서, 왜 그렇게 생각했는지 되묻는 질문 한 개를 만들어라.

규칙:
- 인용은 반드시 주어진 그 문장이어야 한다. 독후감의 다른 문장을 인용하지 마라.
- 독후감 전문은 맥락 파악용이다. 독후감에 이미 쓰여 있는 내용을 그대로 되풀이하면
  답이 되는 질문은 만들지 마라. 이미 쓴 것보다 한 걸음 더 들어가게 물어라.
- 해석·근거형 질문만. "어느 장면에서", "왜 그렇게 느꼈는지"를 묻는다.
- 등장인물 이름이나 지엽적 사실을 묻지 마라. 읽었어도 잊을 수 있다.
- "만약 ~라면" 가정형을 묻지 마라. 채점 기준을 세울 수 없다.
- 인용은 자연스럽게 이어 붙여라. "~다라고 했는데" 처럼 조사를 겹쳐 쓰지 마라.
- 반말로 한 문장. 30초 안에 답할 수 있는 크기여야 한다.
- 답을 유도하거나 힌트를 주지 마라.`;

/** 따옴표 없이 "…다라고 했는데" 로 붙은 경우. 따옴표 뒤의 "라고" 는 맞는 인용이다. */
const DOUBLED_PARTICLE = /[다요]라고\s*(했|썼|말했)/;

const SPACING_MS = 5_000;
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

interface Tally {
  echoed: number;
  doubled: number;
}

function score(tally: Tally, question: string, quote: string): string {
  const echoed = echoesQuote(question, quote);
  const doubled = DOUBLED_PARTICLE.test(question);
  if (echoed) tally.echoed += 1;
  if (doubled) tally.doubled += 1;
  return `${echoed ? "되풀이" : "      "} ${doubled ? "겹침" : "    "}`;
}

async function main() {
  console.log(`model: ${process.env.LLM_MODEL?.trim() || "(미설정)"}\n`);

  const before: Tally = { echoed: 0, doubled: 0 };
  const after: Tally = { echoed: 0, doubled: 0 };
  let asked = 0;

  for (const review of TEST_REVIEWS) {
    const context = { gradeLevel: review.gradeLevel };
    const { gaps } = await paced("gap-analysis", () =>
      analyzeGaps(review.body, review.book, context),
    );
    if (gaps.length === 0) {
      console.log(`${review.id}  빈틈 0개 — 건너뜀\n`);
      continue;
    }

    const gap = gaps[0];
    const previous = await paced("question-before", () =>
      callJson({
        label: "question",
        schema: questionSchema,
        system: PREVIOUS_SYSTEM,
        user: questionUser(gap, review.body, review.book, context),
        maxTokens: 2048,
      }),
    );
    const current = await paced("question-after", () =>
      buildQuestion(gap, review.body, review.book, context),
    );
    asked += 1;

    console.log(`${review.id}  문장: "${gap.quote}"`);
    console.log(`  전 ${score(before, previous.question, gap.quote)} | ${previous.question}`);
    console.log(`  후 ${score(after, current.question, gap.quote)} | ${current.question}\n`);
  }

  console.log("─".repeat(64));
  console.log(`질문 ${asked}건`);
  console.log(`  되풀이  전 ${before.echoed}/${asked}  →  후 ${after.echoed}/${asked}`);
  console.log(`  겹침    전 ${before.doubled}/${asked}  →  후 ${after.doubled}/${asked}`);
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
