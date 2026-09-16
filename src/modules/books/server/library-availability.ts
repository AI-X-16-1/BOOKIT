// src/modules/books/server/library-availability.ts
/**
 * 국립중앙도서관 소장자료 검색 API — ISBN으로 "관외이용 무료" 원문 뷰어가 있는지 확인한다.
 *
 * server/source.ts의 nlkSource가 쓰는 서지정보(SEOJI) API와는 다른 엔드포인트다 —
 * 같은 NLK_API_KEY로 접근되지만 URL·파라미터·응답 모양이 전혀 다르다.
 *
 * 2026-09-16에 실제 키로 검증(이슈 #72): `licYn="N"`("[관외이용]-무료")이라고 나와도
 * `orgLink`가 비어있거나 문자열 "이용불가"인 경우가 흔하다 — 예: 아몬드(9788936434267)는
 * licYn=N인데 orgLink가 비어 있다(종이책만 소장, 원문 없음). 반대로 오래된 아동문학
 * (예: 전래동화, ISBN 8989929652)은 실제로
 * `https://viewer.nl.go.kr/nlmivs/viewWonmun_js.jsp?cno=...` 형태의 진짜 주소를 준다.
 * 그래서 두 조건을 다 확인해야만 "진짜로 클릭해서 열리는 링크"다.
 *
 * 새로 검색으로 들어온 책을 처음 저장할 때만 부른다(server/search.ts) — 이미 저장된
 * 책은 재확인하지 않아 호출이 늘어나지 않는다. 실패해도(타임아웃·에러) 검색 자체를
 * 막지 않는다 — 있으면 좋은 부가 정보일 뿐이다.
 */
import "server-only";

interface NlkHoldingItem {
  isbn?: string;
  licYn?: string;
  orgLink?: string;
}

/**
 * `licYn === "N"`(관외이용 무료) 이면서 `orgLink`가 실제 주소일 때만 그 링크를 돌려준다.
 * `items`가 배열이 아니거나 일치하는 항목이 없으면 null.
 */
export function pickUsableOrgLink(items: unknown, isbn13: string): string | null {
  if (!Array.isArray(items)) return null;
  for (const raw of items) {
    if (typeof raw !== "object" || raw === null) continue;
    const item = raw as NlkHoldingItem;
    if (
      item.isbn === isbn13 &&
      item.licYn === "N" &&
      typeof item.orgLink === "string" &&
      item.orgLink !== "" &&
      item.orgLink !== "이용불가"
    ) {
      return item.orgLink;
    }
  }
  return null;
}

export async function checkNlkLibraryAvailability(
  isbn13: string,
): Promise<string | null> {
  const key = process.env.NLK_API_KEY;
  if (!key) return null;

  const url = new URL("https://www.nl.go.kr/NL/search/openApi/search.do");
  url.searchParams.set("key", key);
  url.searchParams.set("apiType", "json");
  url.searchParams.set("kwd", isbn13);
  url.searchParams.set("pageSize", "10");

  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) return null;
    const body: unknown = await res.json();
    const result = (body as { result?: unknown } | null)?.result;
    return pickUsableOrgLink(result, isbn13);
  } catch {
    return null;
  }
}
