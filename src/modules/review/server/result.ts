/**
 * review/server/result — 도메인 함수의 반환 봉투. owner: 박재경
 *
 * 라우트는 얇게 두고 판단은 서버 모듈이 한다 (CLAUDE.md §2). 그래서 도메인 함수가
 * HTTP 상태와 화면 문구까지 정해서 돌려주고, 라우트는 그대로 옮기기만 한다.
 * verification/server/result 와 같은 모양이다.
 *
 * message 는 아이가 그대로 읽는 문장이다 — 반말, 짧게, 혼내지 않기 (CLAUDE.md §9).
 */
import "server-only";

export type ReviewResult<T> =
  | { ok: true; data: T }
  | { ok: false; code: string; message: string; status: number };

export const failure = (
  code: string,
  message: string,
  status: number,
): ReviewResult<never> => ({ ok: false, code, message, status });

export const reviewNotFound = () =>
  failure("review_not_found", "그 독후감을 찾을 수 없어.", 404);
