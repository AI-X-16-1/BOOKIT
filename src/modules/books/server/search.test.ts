// src/modules/books/server/search.test.ts
import assert from "node:assert/strict";
import { test } from "node:test";

import type { Book } from "@/shared/types";
import type { BookInsertRow, BooksAdminPort } from "./db";
import { searchAndUpsertBooks } from "./search";
import { BookSourceError, type BookSource } from "./source";

function makeFakePort(): BooksAdminPort & { rows: Book[] } {
  const rows: Book[] = [];
  return {
    rows,
    async findByIsbn(isbn13) {
      return rows.find((b) => b.isbn13 === isbn13) ?? null;
    },
    async searchCurated(query, limit) {
      return rows
        .filter((b) => b.curated && (b.title.includes(query) || b.author.includes(query)))
        .slice(0, limit);
    },
    async insertBook(row: BookInsertRow) {
      const book: Book = {
        id: `id-${rows.length + 1}`,
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
      rows.push(book);
      return book;
    },
  };
}

test("검색어가 비어있으면 소스를 부르지 않고 빈 목록", async () => {
  let called = false;
  const source: BookSource = {
    name: "mock",
    async search() {
      called = true;
      return [];
    },
  };
  const result = await searchAndUpsertBooks(makeFakePort(), source, "   ");
  assert.deepEqual(result, { ok: true, books: [] });
  assert.equal(called, false);
});

test("isbn13 없는 결과는 걸러낸다", async () => {
  const source: BookSource = {
    name: "mock",
    async search() {
      return [
        {
          isbn13: null,
          title: "무제",
          author: "미상",
          publisher: null,
          coverUrl: null,
          rawCategory: null,
          kdc: null,
          targetGradeMin: null,
          targetGradeMax: null,
        },
      ];
    },
  };
  const result = await searchAndUpsertBooks(makeFakePort(), source, "무제");
  assert.deepEqual(result, { ok: true, books: [] });
});

test("같은 isbn13은 두 번 insert하지 않는다", async () => {
  const hit = {
    isbn13: "9791100000001",
    title: "아몬드",
    author: "손원평",
    publisher: "창비",
    coverUrl: null,
    rawCategory: "성장소설",
    kdc: null,
    targetGradeMin: 6,
    targetGradeMax: 9,
  };
  const source: BookSource = {
    name: "mock",
    async search() {
      return [hit];
    },
  };
  const port = makeFakePort();
  const first = await searchAndUpsertBooks(port, source, "아몬드");
  const second = await searchAndUpsertBooks(port, source, "아몬드");
  assert.equal(port.rows.length, 1);
  if (first.ok && second.ok) {
    assert.equal(first.books[0].id, second.books[0].id);
    assert.equal(first.books[0].target_grade_min, 6);
    assert.equal(first.books[0].target_grade_max, 9);
  }
});

test("BookSourceError는 book_source_unavailable로 변환된다", async () => {
  const source: BookSource = {
    name: "nlk",
    async search() {
      throw new BookSourceError("nlk", "테스트 오류");
    },
  };
  const result = await searchAndUpsertBooks(makeFakePort(), source, "아무거나");
  assert.deepEqual(result, {
    ok: false,
    code: "book_source_unavailable",
    message: "지금 책을 검색할 수 없어. 잠시 후 다시 해봐.",
    status: 503,
  });
});

test("외부 소스가 죽어도 시드(curated)에서 찾은 책은 돌려준다", async () => {
  const port = makeFakePort();
  const seeded = await port.insertBook({
    title: "아몬드", author: "손원평", publisher: "창비", isbn13: "9788936434267", curated: true,
  });
  const source: BookSource = {
    name: "nlk",
    async search() {
      throw new BookSourceError("nlk", "timeout");
    },
  };
  const result = await searchAndUpsertBooks(port, source, "아몬드");
  assert.deepEqual(result, { ok: true, books: [seeded] });
});

test("제목·저자에 검색어가 없는 외부 결과는 버린다 (NLK 의 시리즈·설명 매칭)", async () => {
  const base = { publisher: "창비", coverUrl: null, rawCategory: null, kdc: null, targetGradeMin: 4, targetGradeMax: 9 };
  const source: BookSource = {
    name: "nlk",
    async search() {
      return [
        { ...base, isbn13: "9791100000001", title: "아몬드", author: "손원평" },
        { ...base, isbn13: "9791100000002", title: "완득이", author: "김려령" },
      ];
    },
  };
  const result = await searchAndUpsertBooks(makeFakePort(), source, "아몬드");
  assert.ok(result.ok);
  if (result.ok) assert.deepEqual(result.books.map((b) => b.title), ["아몬드"]);
});
