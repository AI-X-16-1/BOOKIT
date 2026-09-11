/**
 * verification/server 배럴.
 *
 * server-only 를 import 하는 파일만 모은다 — 클라이언트 컴포넌트에서는 쓰지 않는다.
 * 바깥 모듈은 여기가 아니라 modules/verification/index.ts 를 통해 가져간다 (CLAUDE.md §2).
 */

export { issueQuestion, type QuestionMode } from "./question";
export { gradeAnswer } from "./answer";
export { answerWindowSeconds, pointsPerPass, GRACE_SECONDS } from "./window";
export type { VerificationResult } from "./result";
