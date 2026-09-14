/**
 * 핵심 문장 고르기(#2b) 실호출 검증 (#14). owner: 강민구
 *
 *   node --conditions=react-server --env-file-if-exists=.env.local --import tsx scripts/ai-core-claim.ts
 *
 * package.json 에 스크립트를 올리지 않았다 — #14 가 결정되기 전의 검증용이라
 * 다른 PR 과 package.json 충돌을 만들 이유가 없다. 결정되면 ai:gaps 에 합친다.
 *
 * 여기서 보는 것은 세 가지.
 *   1. quote 가 독후감 원문과 글자 그대로 일치하는가 (하이라이트가 뜨는가)
 *   2. 줄거리 문장이 아니라 학생의 판단이 담긴 문장을 고르는가
 *   3. 그 문장으로 만든 질문이 해석·근거형인가 — 잘 쓴 아이는 쉽게 답하고,
 *      대필한 아이는 자기 글의 근거를 즉석에서 대야 한다
 */
import { buildQuestion, LlmError, pickCoreClaim } from "@/modules/ai";

import { byCategory } from "./fixtures/test-reviews";

/** 무료 티어 분당 한도(15 RPM) 대응. ai-gaps.ts 와 같은 방식이다. */
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
      console.log(
        `   … ${label} 요청 한도. ${RATE_LIMIT_WAIT_MS / 1000}초 기다렸다 다시 한다 (${attempt}/3)`,
      );
      await sleep(RATE_LIMIT_WAIT_MS);
    }
  }
  throw new LlmError("rate_limited", `[${label}] 요청 한도가 풀리지 않는다.`);
}

async function main() {
  // 잘 쓴 것 = 빈틈 0개가 실제로 나온 무리, 대필 = 막아야 하는 무리.
  // 인자로 id 를 주면 그것만 돈다 — `... scripts/ai-core-claim.ts g4 w1`
  const only = process.argv.slice(2);
  const samples = [...byCategory("well_written"), ...byCategory("ghostwritten")].filter(
    (sample) => only.length === 0 || only.includes(sample.id),
  );
  let exact = 0;

  for (const sample of samples) {
    console.log(`\n${"─".repeat(58)}\n▸ ${sample.id} (${sample.category}) — ${sample.book.title}`);
    const context = { gradeLevel: sample.gradeLevel };

    const claim = await paced("core-claim", () =>
      pickCoreClaim(sample.body, sample.book, context),
    );
    if (!claim) {
      console.log("   ✕ quote 가 원문에 없어 null — 호출부는 초고로 돌려보낸다");
      continue;
    }

    exact += 1;
    console.log(`   ✓ "${claim.quote}"`);
    console.log(`      → ${claim.reason}`);

    // ⚠️ gap_type enum 에 값이 없어 임시로 unsupported_claim 을 붙인다. 질문 프롬프트는
    //    type 을 쓰지 않고 quote·reason 만 쓰므로 결과에 영향이 없다 (prompts.ts questionUser).
    const { question } = await paced("question", () =>
      buildQuestion(
        { quote: claim.quote, type: "unsupported_claim", reason: claim.reason },
        sample.body,
        sample.book,
        context,
      ),
    );
    console.log(`   Q: ${question}`);
  }

  console.log(`\n${"─".repeat(58)}\nquote 원문 일치 ${exact}/${samples.length}. 검증 종료.`);
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
