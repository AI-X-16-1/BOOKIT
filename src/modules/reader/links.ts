/**
 * 서재에서 책 한 권을 바로 여는 주소. owner: 강민구
 *
 * 다른 모듈이 "서재에서 읽기" 링크를 만들 때 쓴다 — books 의 책 안내 시트 등 (#58).
 * 서재에 있는 책(books.is_public_domain 이고 본문이 있는 책)만 넘긴다.
 * 서재에 없는 책 id 가 오면 서재는 조용히 목록을 보여준다.
 */
export function libraryHref(bookId: string, chapterNo = 1): string {
  const params = new URLSearchParams({ book: bookId });
  if (chapterNo > 1) params.set("chapter", String(chapterNo));
  return `/library?${params}`;
}
