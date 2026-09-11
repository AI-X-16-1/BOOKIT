/**
 * review — owner: 박재경
 *
 * 독후감 에디터, 자동 저장, 초고 상태 관리.
 *
 * 이 파일이 모듈의 유일한 public surface다.
 * 다른 모듈은 반드시 여기를 통해서만 import 한다 (CLAUDE.md §2).
 * 내부 구조: components/ · server/ · schema.ts
 *
 * 라우트 (docs/spec.md §5):
 *   POST  /api/reviews             { book_id }  → { review }  (draft)
 *   PATCH /api/reviews/:id         { body }     → { review }  자동 저장, 2s 디바운스
 *   POST  /api/reviews/:id/submit               → { gaps[] }  AI #2 빈틈 분석
 *
 * reviews.body 는 학생 본인에게만 보인다 — is_shared 를 켜지 않는 한
 * 교사도 보호자도 볼 수 없다 (CLAUDE.md §5).
 *
 * ⚠️ 서버 로직은 여기서 re-export 하지 않는다. 이 배럴은 클라이언트 컴포넌트를 내보낸다.
 *    Route Handler 와 서버 컴포넌트는 "@/modules/review/server" 를 직접 import 한다.
 */

export { WriteFlow, type WriteFlowProps } from "./components/WriteFlow";
export { ReviewEditor, type ReviewEditorProps } from "./components/ReviewEditor";
export { PickBookFirst } from "./components/PickBookFirst";
export {
  createReviewSchema,
  updateReviewSchema,
  MAX_REVIEW_CHARS,
  MIN_SUBMIT_CHARS,
  type WriteSession,
} from "./schema";

/** 다른 모듈의 mock 이 쓰는 가짜 지연. 그쪽 목이 걷히면 함께 지운다 */
export { delay } from "./mock";
