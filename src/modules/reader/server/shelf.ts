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

/**
 * 서재 목록을 내 학년에 맞춰 보여주기 위해 학년만 읽는다.
 *
 * profiles 는 auth 모듈 소유라 값을 바꾸지 않고 한 칸만 읽는다. RLS 가 본인 행만
 * 내주므로 남의 학년은 못 본다. auth 가 나중에 학년을 담은 헬퍼를 내보내면 그걸로 바꾼다.
 * 교사이거나 아직 학년이 없으면 null — 그때 서재는 원래 순서 그대로다.
 */
export async function readMyGrade(
  supabase: BookitClient,
  userId: string,
): Promise<number | null> {
  const { data, error } = await supabase
    .from("profiles")
    .select("grade_level")
    .eq("id", userId)
    .maybeSingle();

  if (error) {
    console.warn("[reader] 학년을 읽지 못해 서재를 기본 순서로 보여준다", error);
    return null;
  }
  return data?.grade_level ?? null;
}
