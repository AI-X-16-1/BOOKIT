/**
 * books 요청 파라미터 검증.
 *
 * GET 라우트만 있어서 body 검증은 필요 없다 — 쿼리 파라미터 두 개만 다룬다.
 */

/** 검색어. 없거나 공백뿐이면 빈 문자열로 정규화한다 (에러 아님 — 타이핑 중일 수 있음) */
export function parseSearchQuery(raw: string | null): string {
  return raw?.trim() ?? "";
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** books.id 형식 검증. 형식이 아니면 null — 호출부가 400으로 응답한다 */
export function parseBookId(raw: string | undefined): string | null {
  if (!raw) return null;
  return UUID_RE.test(raw) ? raw : null;
}
