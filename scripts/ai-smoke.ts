/**
 * AI 4종 실호출 스모크 — `npm run ai:smoke`
 *
 * 파이프라인을 처음부터 끝까지 한 번 통과시킨다.
 *   #1 글쓰기 도우미 → #2 빈틈 분석 → #3 꼬리질문 → #4 채점
 *
 * 실제 API 를 5번 부른다(비용 발생). .env.local 에 LLM_API_KEY 가 있어야 한다.
 * 채점 기준을 잡는 건 이 스크립트가 아니라 npm run ai:gaps 와 4일차 20건 테스트다.
 * 여기서 보는 것은 "네 호출이 전부 살아서 계약대로 돌아오는가" 뿐이다.
 */
import {
  analyzeGaps,
  buildQuestion,
  grade,
  LlmError,
  readThreshold,
  writingHelper,
} from "@/modules/ai";
import type { BookContext } from "@/shared/types";

const BOOK: BookContext = {
  title: "마당을 나온 암탉",
  author: "황선미",
  tags: ["성장소설", "모험"],
};

const GRADE = 5;

const REVIEW = [
  "잎싹은 마당을 나와서 자유를 찾고 싶어 했다.",
  "청둥오리 알을 품어서 초록이를 키웠는데 다른 오리들이 싫어했다.",
  "그래도 잎싹은 끝까지 초록이를 지켰다.",
  "잎싹은 훌륭한 엄마라고 생각한다.",
].join(" ");

const ANSWER =
  "초록이가 파수꾼 뽑힐 때 다른 오리들이 반대했는데 잎싹이 계속 옆에 있어줬어. 그래서 훌륭하다고 생각했어.";

async function timed<T>(label: string, run: () => Promise<T>): Promise<T> {
  const startedAt = Date.now();
  const value = await run();
  console.log(`\n▸ ${label}  (${Date.now() - startedAt}ms)`);
  return value;
}

async function main() {
  console.log(`provider: ${process.env.LLM_PROVIDER?.trim() || "(기본값)"}`);
  console.log(`model:    ${process.env.LLM_MODEL?.trim() || "(미설정)"}`);
  console.log(`threshold: ${readThreshold()}`);

  // #1 — 실패해도 서비스가 죽지 않는 유일한 호출이다. 여기서도 그렇게 다룬다.
  try {
    const helper = await timed("#1 글쓰기 도우미", () => writingHelper(BOOK, GRADE));
    console.log(`  ${helper.question}`);
  } catch (error) {
    const reason = error instanceof LlmError ? error.kind : String(error);
    console.log(`\n▸ #1 글쓰기 도우미 — 실패(${reason}). 도우미 없이 진행한다.`);
  }

  const { gaps } = await timed("#2 빈틈 분석", () =>
    analyzeGaps(REVIEW, BOOK, { gradeLevel: GRADE }),
  );
  for (const gap of gaps) {
    const exact = REVIEW.includes(gap.quote);
    console.log(`  ${exact ? "✓" : "✕"} [${gap.type}] "${gap.quote}"`);
  }
  if (gaps.length === 0) {
    console.log("  빈틈 0개 — 질문 없이 통과 대상 (이슈 #14 참고)");
    return;
  }

  const { question } = await timed("#3 꼬리질문", () =>
    buildQuestion(gaps[0], REVIEW, BOOK, { gradeLevel: GRADE }),
  );
  console.log(`  Q: ${question}`);

  const result = await timed("#4 채점", () =>
    grade(REVIEW, gaps[0], question, ANSWER, BOOK, { gradeLevel: GRADE }),
  );
  console.log(`  logic=${result.logic_consistency}`);
  console.log(`  specificity=${result.specificity}`);
  console.log(`  style=${result.style_consistency}`);
  console.log(`  ${result.passed ? "✓ 통과" : "✕ 미통과"} — ${result.feedback}`);

  console.log("\n스모크 통과.");
}

main().catch((error: unknown) => {
  if (error instanceof LlmError) {
    console.error(`\n✕ [${error.kind}] ${error.message}`);
    if (error.kind === "not_configured") {
      console.error("  .env.local 에 LLM_API_KEY 를 채우고 다시 실행해라.");
    }
    process.exitCode = 1;
    return;
  }
  console.error(`\n✕ ${error instanceof Error ? error.stack : String(error)}`);
  process.exitCode = 1;
});
