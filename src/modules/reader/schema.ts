/**
 * reader — 모듈 안에서만 쓰는 타입. owner: 강민구
 *
 * API 계약(ReaderChapterResponse·DictResponse)은 src/shared/types 에 있다.
 * 서재 책 목록은 라우트로 나가지 않고 서버 컴포넌트가 화면에 바로 넘기므로 여기 둔다.
 */

/** 책잇 서재 한 칸. 본문이 한 장이라도 있는 저작권 만료 도서만 들어온다. */
export interface ShelfBook {
  id: string;
  title: string;
  author: string;
  gradeMin: number | null;
  gradeMax: number | null;
  /** book_contents 의 장 수. 1장부터 빈틈 없이 이어진다고 가정한다 */
  chapterCount: number;
}
