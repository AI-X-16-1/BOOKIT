/**
 * reader — owner: 강민구
 *
 * 책잇 서재 — 저작권 만료 텍스트 렌더링, 단어 탭 사전(국립국어원 API).
 *
 * 이 파일이 모듈의 유일한 public surface다.
 * 다른 모듈은 반드시 여기를 통해서만 import 한다 (CLAUDE.md §2).
 * 내부 구조: components/ · server/ · schema.ts
 *
 * 계획된 export (docs/spec.md §5):
 *   GET /api/reader/:bookId?chapter=1  → { title, body }
 *   GET /api/dict?word=                → { word, definition, source }
 *
 * 본문은 18px / line-height 2 (CLAUDE.md §8).
 * 사전은 768px 미만에서 바텀시트, 이상에서 사이드 패널.
 */
export {};
