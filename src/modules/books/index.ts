/**
 * books — owner: 이승환
 *
 * 국립중앙도서관 / 국립어린이청소년도서관 API, 검색, 장르 인접 추천, 국회도서관 handoff.
 * 알라딘 오픈API는 2026-09-04 서비스 종료 — 국립중앙도서관을 주 소스로 대체했다
 * (docs/superpowers/specs/2026-09-14-books-search-recommend-design.md).
 *
 * 이 파일은 모듈의 client-safe public surface다 (components/ · mock · schema.ts).
 * 다른 모듈은 반드시 여기를 통해서만 import 한다 (CLAUDE.md §2).
 * 서버 전용 조각(Route Handler, 스크립트에서 쓰는 DB 포트·소스 어댑터·응답 헬퍼 등)은
 * `./server`를 통해서만 import 한다 — 이유는 그 파일 상단 주석 참고. HomeScreen("use
 * client")과 server-only 코드를 한 배럴에 같이 export하면 client component가 이 파일의
 * 아무 값이나 하나만 가져와도 Next 빌드가 깨지기 때문에 분리했다.
 * 내부 구조: components/ · server/ · schema.ts
 *
 * 구현 완료: GET /api/books/search, /api/books/recommend, /api/books/:id
 *
 * 표지는 원래 알라딘 image URL을 쓸 계획이었으나 소스 교체로 대부분 비어 있을 수 있다 —
 * 그 경우 목업의 그라데이션 placeholder(CoverTone)를 그대로 쓴다 (CLAUDE.md §10).
 */

export { HomeScreen } from "./components/HomeScreen";
export { BOOKS, COVER, searchBooks, type CoverTone, type DemoBook } from "./mock";

export { parseBookId, parseSearchQuery } from "./schema";
