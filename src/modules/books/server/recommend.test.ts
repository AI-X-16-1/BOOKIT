import assert from "node:assert/strict";
import { test } from "node:test";

import type { Book } from "@/shared/types";
import type { BooksReadPort } from "./db";
import { recommendBooks } from "./recommend";

function book(partial: Partial<Book>): Book {
  return {
    id: "id",
    isbn13: null,
    title: "제목",
    author: "저자",
    publisher: "출판사",
    cover_url: null,
    tags: [],
    target_grade_min: null,
    target_grade_max: null,
    is_public_domain: false,
    library_url: null,
    aladin_url: null,
    curated: true,
    ...partial,
  };
}

test("추천 결과에 나온 태그들을 reasonTags로 합친다", async () => {
  const port: BooksReadPort = {
    async listByGrade() {
      return [book({ tags: ["성장소설"] }), book({ tags: ["모험", "성장소설"] })];
    },
    async getById() {
      return null;
    },
  };

  const result = await recommendBooks(port, 5);
  assert.equal(result.books.length, 2);
  assert.deepEqual(result.reasonTags.sort(), ["모험", "성장소설"].sort());
});

test("책이 없으면 reasonTags도 빈 배열", async () => {
  const port: BooksReadPort = {
    async listByGrade() {
      return [];
    },
    async getById() {
      return null;
    },
  };
  const result = await recommendBooks(port, 5);
  assert.deepEqual(result.reasonTags, []);
});
