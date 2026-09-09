/**
 * review — owner: 박재경
 *
 * 독후감 에디터, 자동 저장, 초고 상태 관리.
 *
 * 이 파일이 모듈의 유일한 public surface다.
 * 다른 모듈은 반드시 여기를 통해서만 import 한다 (CLAUDE.md §2).
 * 내부 구조: components/ · server/ · schema.ts
 *
 * 계획된 export (docs/spec.md §5):
 *   POST  /api/reviews             { book_id }  → { review }  (draft)
 *   PATCH /api/reviews/:id         { body }     → { review }  자동 저장, 2s 디바운스
 *   POST  /api/reviews/:id/submit               → { gaps[] }  AI #2 실행 + AI #3 미리 생성
 *
 * reviews.body 는 학생 본인에게만 보인다 — is_shared 를 켜지 않는 한
 * 교사도 보호자도 볼 수 없다 (CLAUDE.md §5).
 *
 * ⚠️ 아래 mock export 는 임시다. Supabase 연결 없이 목업대로 화면을 보기 위한 것이고,
 *    실제 Route Handler 가 붙으면 mock.ts 와 함께 지운다.
 */

export { WriteFlow } from "./components/WriteFlow";
export { ReviewEditor, type ReviewEditorProps } from "./components/ReviewEditor";
export {
  delay,
  submitReview,
  writingHelper,
  MOCK_BOOK,
  MOCK_REVIEW,
  MOCK_REVIEW_BODY,
} from "./mock";
