// scripts/books-smoke.ts
/**
 * books 모듈 스모크 — `npm run books:smoke`
 *
 * 외부 키도 Supabase 연결도 없이, mock 소스 + 인메모리 포트로
 * search → recommend → detail 흐름이 계약대로 도는지 확인한다.
 * 실제 Supabase/국립중앙도서관 연결 확인은 이 스크립트의 범위가 아니다
 * (scripts/check-supabase.mjs, README 참고).
 *
 * ⚠️ 이 파일만 예외적으로 `@/modules/books` 배럴이 아니라 `server/*` 개별 파일에서
 * 바로 import한다 — books/index.ts는 `HomeScreen`("use client", next/link 포함)도
 * 같이 export하는데, Next 번들러 없이 `--conditions=react-server`로 plain node에서
 * 배럴 전체를 로드하면 react.react-server.js에 createContext가 없어 크래시한다
 * (Task 4의 mock.ts/review 배럴 문제와 같은 종류지만, 이번엔 HomeScreen이 books 자신의
 * 정당한 public export라 지울 수 없다 — src/app/(main)/home/page.tsx가 실제로 쓴다).
 * (barrel을 섞어 쓰면 실제 빌드도 깨질 수 있다 — rewards/MeScreen.tsx가 COVER를
 * @/modules/books에서 가져오다 서버 전용 코드까지 클라이언트 번들에 끌려들어가
 * 빌드가 실패한 적이 있고, books/index.ts를 client-safe 배럴과
 * server/index.ts(서버 전용 배럴)로 나눠서 고쳤다. 이 스크립트의 우회는 그것과는
 * 별개로, 번들러가 아예 없는 plain node 실행 환경에서만 필요하다.)
 */
import { randomUUID } from "node:crypto";

import type { Book } from "@/shared/types";
import type { BookInsertRow, BooksAdminPort, BooksReadPort } from "@/modules/books/server/db";
import { getBookById } from "@/modules/books/server/detail";
import { recommendBooks } from "@/modules/books/server/recommend";
import { searchAndUpsertBooks } from "@/modules/books/server/search";
import { mockSource } from "@/modules/books/server/source";

class FakeBooksStore implements BooksAdminPort, BooksReadPort {
  private rows = new Map<string, Book>();

  async findByIsbn(isbn13: string): Promise<Book | null> {
    return [...this.rows.values()].find((b) => b.isbn13 === isbn13) ?? null;
  }

  async insertBook(row: BookInsertRow): Promise<Book> {
    const book: Book = {
      id: randomUUID(),
      isbn13: row.isbn13 ?? null,
      title: row.title,
      author: row.author,
      publisher: row.publisher,
      cover_url: row.cover_url ?? null,
      tags: row.tags ?? [],
      target_grade_min: row.target_grade_min ?? null,
      target_grade_max: row.target_grade_max ?? null,
      is_public_domain: row.is_public_domain ?? false,
      library_url: row.library_url ?? null,
      aladin_url: row.aladin_url ?? null,
      curated: row.curated ?? false,
    };
    this.rows.set(book.id, book);
    return book;
  }

  async listByGrade(gradeLevel: number, limit: number): Promise<Book[]> {
    return [...this.rows.values()]
      .filter(
        (b) =>
          (b.target_grade_min === null || b.target_grade_min <= gradeLevel) &&
          (b.target_grade_max === null || b.target_grade_max >= gradeLevel),
      )
      .sort((a, b) => a.title.localeCompare(b.title))
      .slice(0, limit);
  }

  async getById(id: string): Promise<Book | null> {
    return this.rows.get(id) ?? null;
  }
}

async function main() {
  const store = new FakeBooksStore();

  console.log("1) 검색: '아몬드'");
  const search1 = await searchAndUpsertBooks(store, mockSource, "아몬드");
  console.log(search1);

  console.log("\n2) 같은 검색 다시 (중복 insert 없이 기존 행을 반환해야 함)");
  const search2 = await searchAndUpsertBooks(store, mockSource, "아몬드");
  console.log(search2);
  if (search1.ok && search2.ok) {
    const same = search1.books[0]?.id === search2.books[0]?.id;
    console.log(`   같은 id 재사용: ${same ? "OK" : "FAIL"}`);
    if (!same) process.exitCode = 1;
  }

  console.log("\n3) 추천 (6학년)");
  console.log(await recommendBooks(store, 6));

  if (search1.ok && search1.books[0]) {
    console.log("\n4) 상세 조회");
    console.log(await getBookById(store, search1.books[0].id));
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
