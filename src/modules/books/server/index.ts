/**
 * books/server — 모듈의 서버 전용 public surface.
 *
 * `src/modules/books/index.ts`는 client component(HomeScreen)와 mock 데이터도
 * 같이 export하는데, 이 파일들이 각각 "server-only"를 import하는 server/* 파일과
 * 한 배럴에 섞이면 Next 빌드가 깨진다 — client component(예: rewards 모듈의
 * MeScreen.tsx)가 `@/modules/books`에서 단 하나의 심볼만 가져와도, 번들러가 그
 * 배럴 파일의 전체 import 그래프를 client 번들 후보로 훑기 때문에
 * "'server-only' cannot be imported from a Client Component module" 에러가 난다
 * (tree-shaking은 이 검사보다 늦게 적용된다).
 *
 * 그래서 서버 전용 조각(Route Handler, 스크립트)은 이 파일을 통해서만 가져온다 —
 * CLAUDE.md §2의 "cross-module 진입은 index.ts만" 원칙을, client/server 두
 * 갈래로 나눠 그대로 지킨 것이다. `src/modules/books/index.ts`는 client-safe한
 * 것(components/, mock, schema)만 남긴다.
 */
export {
  createSupabaseBooksAdminPort,
  createSupabaseBooksReadPort,
  type BooksAdminPort,
  type BooksReadPort,
  type BookInsertRow,
} from "./db";
export { getBookSource, mockSource } from "./source";
export { searchAndUpsertBooks, type SearchResult } from "./search";
export { recommendBooks, type RecommendResult } from "./recommend";
export { getBookById } from "./detail";
export { badRequest, fail, ok, unauthorized } from "./response";
