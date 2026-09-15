/**
 * reader/server/chapter — 책잇 서재 본문. owner: 강민구
 *
 * 저작권이 만료된 책만 읽을 수 있다. 그 판단은 여기서 하지 않고 RLS 가 한다 —
 * book_contents_select_public_domain 정책이 books.is_public_domain 을 확인한다
 * (supabase/migrations/0002_books.sql).
 *
 * 즉 저작권 있는 책의 본문은 쿼리 결과가 비어서 돌아온다. 코드에서 한 번 더
 * 거르지 않는 이유는, 조건을 두 군데 두면 한쪽만 고쳐질 때 열려버리기 때문이다.
 */
import "server-only";

import type { BookitClient } from "@/shared/supabase";
import type { ReaderChapterResponse } from "@/shared/types";

export type ChapterErrorKind = "not_found" | "upstream";

export class ChapterError extends Error {
  constructor(
    readonly kind: ChapterErrorKind,
    message: string,
    options?: { cause?: unknown },
  ) {
    super(message, options);
    this.name = "ChapterError";
  }
}

/**
 * 한 챕터의 제목과 본문을 가져온다.
 *
 * 클라이언트를 인자로 받는다 — 라우트 핸들러가 만든 것을 그대로 쓴다.
 * 여기서 직접 만들면 로그인한 사용자가 아니라 익명으로 붙어 RLS 가 다르게 걸린다.
 */
export async function getChapter(
  supabase: BookitClient,
  bookId: string,
  chapterNo: number,
): Promise<ReaderChapterResponse> {
  const { data, error } = await supabase
    .from("book_contents")
    .select("title, body")
    .eq("book_id", bookId)
    .eq("chapter_no", chapterNo)
    .maybeSingle();

  if (error) {
    throw new ChapterError("upstream", "본문을 가져오지 못했다.", { cause: error });
  }

  // 없는 챕터거나, 저작권이 살아 있어 RLS 가 막은 경우다.
  // 둘을 구분해서 알려주지 않는다 — 어떤 책이 DB 에 있는지 알려줄 이유가 없다.
  if (!data) {
    throw new ChapterError("not_found", "이 책은 아직 읽을 수 없어.");
  }

  return { title: data.title, body: data.body };
}

/** ?chapter= 파싱. 없으면 1장. */
export function parseChapterNo(raw: string | null): number | null {
  if (raw === null) return 1;

  const value = Number(raw);
  if (!Number.isInteger(value) || value < 1) return null;
  return value;
}
