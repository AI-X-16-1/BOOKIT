/**
 * LLM 클라이언트 스모크 테스트 — `npm run ai:smoke`
 *
 * 실제로 API 를 두 번 호출한다(비용 발생). .env.local 에 LLM_API_KEY 가 있어야 한다.
 * 프롬프트 4종을 붙이기 전에 전송·스키마 강제·지연이 정상인지만 확인하는 용도다.
 *
 * 여기 쓰인 프롬프트는 임시다. 실제 프롬프트 원문은 docs/prompts.md 에 있고
 * 다음 단계에서 modules/ai/server 아래로 들어간다.
 */
import { callJson, LlmError } from "@/modules/ai/server/llm";
import { analyzeGapsSchema, questionSchema } from "@/modules/ai/schema";

const REVIEW = [
  "나는 이 책을 읽고 정말 감동적이었다.",
  "흥부는 착한 사람이라서 복을 받은 것 같다.",
  "여러 가지 사건이 많이 나와서 재미있었다.",
].join(" ");

async function timed<T>(label: string, run: () => Promise<T>) {
  const startedAt = Date.now();
  const value = await run();
  console.log(`\n▸ ${label}  (${Date.now() - startedAt}ms)`);
  console.dir(value, { depth: null });
  return value;
}

async function main() {
  console.log(`model: ${process.env.LLM_MODEL?.trim() || "(기본값)"}`);

  await timed("질문 한 개", () =>
    callJson({
      label: "smoke-question",
      schema: questionSchema,
      effort: "low",
      system: "너는 초등학생의 독서를 돕는 조력자다. 반말로 짧게 말한다.",
      user: "'흥부와 놀부'를 막 읽은 5학년 학생에게 던질 가이드 질문 한 개만 만들어라.",
    }),
  );

  const { gaps } = await timed("빈틈 분석", () =>
    callJson({
      label: "smoke-gaps",
      schema: analyzeGapsSchema,
      system: "너는 학생의 독후감에서 근거 없는 문장을 찾는 분석기다.",
      user:
        `독후감:\n"""${REVIEW}"""\n\n` +
        "근거 없이 단정(unsupported_claim), 뭉뚱그린 문장(vague_statement), " +
        "감상만 남음(feeling_only) 중 해당하는 문장을 최대 3개 찾아라. " +
        "quote 는 독후감에 있는 문장을 글자 그대로 옮긴다.",
    }),
  );

  // quote 가 원문과 글자 그대로 일치해야 화면에서 하이라이트가 뜬다.
  // 다음 단계에서 analyzeGaps 안으로 들어갈 검증이라 여기서 미리 재 본다.
  for (const gap of gaps) {
    const exact = REVIEW.includes(gap.quote);
    console.log(`  ${exact ? "✓" : "✕"} quote 원문 일치: ${gap.quote}`);
  }

  console.log("\n스모크 통과.");
}

main().catch((error: unknown) => {
  if (error instanceof LlmError) {
    console.error(`\n✕ [${error.kind}] ${error.message}`);
    if (error.kind === "not_configured") {
      console.error("  .env.local 에 LLM_API_KEY 를 채우고 다시 실행해라.");
    }
    process.exit(1);
  }
  throw error;
});
