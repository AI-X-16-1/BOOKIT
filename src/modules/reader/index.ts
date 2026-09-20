/**
 * reader — owner: 강민구
 *
 * 책잇 서재 — 저작권 만료 텍스트 렌더링, 단어 탭 사전(국립국어원 API).
 *
 * 이 파일이 모듈의 유일한 public surface다.
 * 다른 모듈은 반드시 여기를 통해서만 import 한다 (CLAUDE.md §2).
 * 내부 구조: components/ · server/ · schema.ts
 *
 * 라우트 (docs/spec.md §5):
 *   GET /api/reader/:bookId?chapter=1  → { title, body }
 *   GET /api/dict?word=                → { word, definition, source, senses[] }
 *   POST /api/reading/progress         → { read_chapters, total_chapters, character_stage }
 *
 * 화면 주소:
 *   /library                           책 목록
 *   /library?book=<id>&chapter=<n>     그 책의 그 장을 바로 펼친다 — libraryHref() 로 만든다
 *
 * 본문은 18px / line-height 2 (CLAUDE.md §8).
 * 사전은 768px 미만에서 바텀시트, 이상에서 사이드 패널.
 *
 * 이 배럴은 클라이언트에서 import 해도 안전한 것만 담는다.
 * 서버 전용(책 목록·본문 조회·사전 호출)은 "@/modules/reader/server" 에 있다 —
 * server-only 를 import 하므로 한 배럴에 묶으면 클라이언트 빌드가 깨진다.
 */

export { LibraryScreen } from "./components/LibraryScreen";
export { fetchChapter, fetchDictEntry, recordChapterRead } from "./api";
export { libraryHref } from "./links";
export { faceOf, pickPartner, type Partner } from "./partner";
export { readingProgressSchema, wordQuizRequestSchema } from "./schema";
export type { ShelfBook, WordQuizResponse } from "./schema";
