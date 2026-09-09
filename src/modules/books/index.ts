/**
 * books — owner: 이승환
 *
 * 알라딘 / 국립어린이청소년도서관 / 국립중앙도서관 API, 검색,
 * 장르 인접 추천, 국회도서관 핸드오프.
 *
 * 이 파일이 모듈의 유일한 public surface다.
 * 다른 모듈은 반드시 여기를 통해서만 import 한다 (CLAUDE.md §2).
 * 내부 구조: components/ · server/ · schema.ts
 *
 * 계획된 export (docs/spec.md §5):
 *   GET /api/books/search?q=  → { books[] }
 *   GET /api/books/recommend  → { books[], reason_tags[] }
 *   GET /api/books/:id        → { book }
 *
 * 표지는 알라딘 API의 image URL을 쓴다 — 목업의 그라데이션은 자리표시자다 (CLAUDE.md §10).
 * 시간이 부족하면 장르 인접 추천은 같은 태그 단순 목록으로 축소 (CLAUDE.md §11).
 */
export {};
