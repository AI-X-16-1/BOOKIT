/**
 * verification — owner: 박재경
 *
 * 빈틈 분석 화면, 타이머 질문 화면, 채점 결과, 재시도 플로우.
 *
 * 이 파일이 모듈의 유일한 public surface다.
 * 다른 모듈은 반드시 여기를 통해서만 import 한다 (CLAUDE.md §2).
 * 내부 구조: components/ · server/ · schema.ts
 *
 * 계획된 export (docs/spec.md §5):
 *   POST /api/reviews/:id/question      → { verification_id, question, quote, seconds }
 *   POST /api/verifications/:id/answer  { answer } → { passed, scores, feedback, points }
 *   POST /api/reviews/:id/retry         → { verification_id, question, quote, seconds }
 *
 * 카운트다운은 질문이 화면에 뜬 뒤 클라이언트에서 시작하지만,
 * 서버의 asked_at / answered_at 이 진실의 원천이다.
 * asked_at 으로부터 ANSWER_WINDOW_SEC + 5초를 넘겨 도착한 답은 거부한다 (docs/spec.md §5).
 * 재시도는 항상 새 질문을 만든다 — 같은 질문을 다시 내지 않는다 (CLAUDE.md §6).
 *
 * 검증 화면은 의도적으로 어둡다 (--panel). 다른 화면 톤에 맞춰 밝게 펴지 말 것 (CLAUDE.md §7).
 *
 * ⚠️ 아래 mock export 는 임시다. 실제 Route Handler 가 붙으면 mock.ts 와 함께 지운다.
 */

export {
  VerificationFlow,
  type VerificationFlowProps,
  type VerificationStage,
} from "./components/VerificationFlow";
export { GapAnalysisPanel } from "./components/GapAnalysisPanel";
export { QuestionPanel } from "./components/QuestionPanel";
export { ResultCard } from "./components/ResultCard";
export { GAP_LABEL, GAP_TONE, axisLabel } from "./mock";
