/**
 * reader/server/shelf — 책잇 서재 책 목록. owner: 강민구
 *
 * 저작권 만료 도서 중 본문이 들어 있는 책만 돌려준다.
 * 본문 읽기 권한은 chapter.ts 와 마찬가지로 RLS 가 판단한다 —
 * book_contents_select_public_domain 이 막은 책은 장 수가 0 이라 목록에서 빠진다.
 */
import "server-only";

import type { BookitClient } from "@/shared/supabase";

import type { ShelfBook } from "../schema";

export async function listShelf(supabase: BookitClient): Promise<ShelfBook[]> {
  const { data: books, error: booksError } = await supabase
    .from("books")
    .select("id, title, author, target_grade_min, target_grade_max")
    .eq("is_public_domain", true);

  if (booksError) {
    throw new Error("서재 책 목록을 가져오지 못했다.", { cause: booksError });
  }
  if (books.length === 0) return [];

  // 본문(body)은 가져오지 않는다 — 장 수만 센다.
  const { data: chapters, error: chaptersError } = await supabase
    .from("book_contents")
    .select("book_id")
    .in(
      "book_id",
      books.map((book) => book.id),
    );

  if (chaptersError) {
    throw new Error("서재 장 수를 가져오지 못했다.", { cause: chaptersError });
  }

  const counts = new Map<string, number>();
  for (const { book_id } of chapters) {
    counts.set(book_id, (counts.get(book_id) ?? 0) + 1);
  }

  return books
    .map((book) => ({
      id: book.id,
      title: book.title,
      author: book.author,
      gradeMin: book.target_grade_min,
      gradeMax: book.target_grade_max,
      chapterCount: counts.get(book.id) ?? 0,
    }))
    .filter((book) => book.chapterCount > 0)
    .sort(
      (a, b) =>
        (a.gradeMin ?? 99) - (b.gradeMin ?? 99) ||
        a.title.localeCompare(b.title, "ko"),
    );
}
