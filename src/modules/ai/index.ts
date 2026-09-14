/**
 * ai — owner: 강민구
 *
 * 프롬프트 4종(글쓰기 도우미, 빈틈 분석, 질문 생성, 채점), LLM 클라이언트,
 * 장르 태그 정규화.
 *
 * 이 파일이 모듈의 유일한 public surface다.
 * 다른 모듈은 반드시 여기를 통해서만 import 한다 (CLAUDE.md §2).
 * 내부 구조: components/ · server/ · schema.ts
 *
 * 라우트로 직접 노출되지 않는 내부 모듈이다 (docs/spec.md §5).
 * LLM 호출은 전부 서버 사이드에서만 (CLAUDE.md §1).
 *
 * 계획된 export:
 *   writingHelper(book, grade)            → { question }
 *   analyzeGaps(review, book)             → { gaps: Gap[] }   최대 3개
 *   buildQuestion(gap, review)            → { question }
 *   grade(review, gap, question, answer)  → GradeResult
 *
 * 프롬프트 원문은 docs/prompts.md, 타입은 @/shared/types 의 ai.ts 참고.
 * 모든 프롬프트 출력은 strict JSON이며, 형태를 신뢰하지 말고 방어적으로 파싱할 것.
 *
 * 구현 완료: writingHelper(#1), analyzeGaps(#2), buildQuestion(#3), grade(#4),
 *            normalizeGenreTags(프롬프트 #5)
 *
 * 연결 대기: pickCoreClaim(#2b) — 빈틈이 0개일 때 되물을 문장 하나. #14 결정과
 *            gap_type enum 추가가 끝나야 review/server/submit.ts 가 쓸 수 있다.
 *
 * GENRE_TAGS 는 이 모듈이 주인이다. books.tags 와 genre_stamps.genre 가 같은
 * 어휘를 쓰므로, 태그를 다루는 모듈은 여기서 가져다 쓴다 (직접 문자열을 적지 말 것).
 */
export { writingHelper } from "./server/writing-helper";
export { analyzeGaps } from "./server/gaps";
export { pickCoreClaim } from "./server/core-claim";
export type { CoreClaim } from "./schema";
export { buildQuestion } from "./server/question";
export { grade, isPass, readThreshold } from "./server/grade";
export { normalizeGenreTags } from "./server/genre-tags";
export { GENRE_TAGS, type GenreTag } from "./schema";
export type { BookClassification, PassThreshold } from "./server/prompts";
export { LlmError, type LlmErrorKind } from "./server/llm";
export type { PromptContext } from "./server/prompts";
