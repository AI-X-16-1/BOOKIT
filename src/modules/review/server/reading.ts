/**
 * review/server/reading — 표지 퍼즐의 재료. owner: 박재경
 *
 * 9/18 마감 스프린트(docs/sprint-0918.md) ① "책 표지 퍼즐 진행률".
 *
 * 퍼즐 조각 = **읽은 장** 이다 (docs/spec.md §2b). 진행률은
 * `count(reading_progress) / count(book_contents)` 로, 저장된 진행률 칸은 없다 —
 * points_ledger 를 합산하는 것과 같은 이유다 (CLAUDE.md §4).
 *
 * 목업 7 #4 는 "체크포인트를 통과할 때마다 한 조각" 이라고 적었지만 그대로 두지 않았다.
 * 체크포인트는 ③(컷 후보)이고 퍼즐은 ① 이라, 체크포인트가 잘리면 ① 이 영영 안 채워진다.
 * 확정된 spec §2b 쪽(장 단위)을 따랐고 PR #136 에 결정 요청으로 올려 뒀다.
 *
 * 읽기만 한다. `reading_progress` 에 쓰는 것은 reader 소관이다 —
 * 리더가 장 끝에 닿을 때 POST /api/reading/progress (spec §5b, 강민구). 여기서
 * 남의 모듈 테이블을 읽는 것은 session.ts 가 books·streaks 를 읽는 것과 같은 범위다.
 * RLS 는 reading_progress_select_own 이 이미 본인 행만 내려준다 (0014).
 */
import "server-only";

import type { BookitClient } from "@/shared/supabase";

import { idSchema } from "../schema";

/** 한 책의 퍼즐 상태. total 이 0 이면 서재 밖의 책 — 퍼즐을 그리지 않는다 */
export interface ReadingProgress {
  bookId: string;
  readChapters: number;
  totalChapters: number;
}

/** 이어서 읽을 책 한 권 + 그 퍼즐 상태. 홈의 "책 읽기" 카드가 쓴다 */
export interface ContinueReading extends ReadingProgress {
  title: string;
  author: string;
  coverUrl: string | null;
}

/** 그 책의 전체 장 수. 서재에 본문이 없으면 0 (저작권이 살아 있으면 RLS 가 막는다) */
async function countChapters(
  supabase: BookitClient,
  bookId: string,
): Promise<number> {
  const { count, error } = await supabase
    .from("book_contents")
    .select("chapter_no", { count: "exact", head: true })
    .eq("book_id", bookId);

  if (error) throw error;
  return count ?? 0;
}

/**
 * 한 책의 퍼즐 상태.
 *
 * 읽은 장은 **개수만** 센다. 1·3장만 읽었어도 두 조각이 열린다 — spec §2b 의
 * 진행률 정의가 개수이고, 어느 장을 읽었는지로 조각 위치를 정하지 않기 때문이다.
 */
export async function loadReadingProgress(
  supabase: BookitClient,
  userId: string,
  bookId: string,
): Promise<ReadingProgress | null> {
  if (!idSchema.safeParse(bookId).success) return null;

  const [readResult, totalChapters] = await Promise.all([
    supabase
      .from("reading_progress")
      .select("chapter_no", { count: "exact", head: true })
      .eq("student_id", userId)
      .eq("book_id", bookId),
    countChapters(supabase, bookId),
  ]);

  if (readResult.error) throw readResult.error;

  return {
    bookId,
    readChapters: readResult.count ?? 0,
    totalChapters,
  };
}

/**
 * 가장 최근에 읽던 책. 없으면 null — 홈은 "서재에서 골라 읽기" 로 떨어진다.
 *
 * 다 읽은 책은 건너뛴다. "이어서 읽기" 카드인데 완독한 책을 물고 있으면 눌러도
 * 읽을 게 없다. 완독한 책의 다음 걸음은 읽기가 아니라 독후감이라, 그건 옆의
 * "독후감 쓰기" 카드가 맡는다.
 */
export async function loadContinueReading(
  supabase: BookitClient,
  userId: string,
): Promise<ContinueReading | null> {
  // 최근 읽은 순서로 책을 훑는다. 한 학생의 진행 행은 많아도 수십 개다
  const { data, error } = await supabase
    .from("reading_progress")
    .select("book_id, read_at, books (title, author, cover_url)")
    .eq("student_id", userId)
    .order("read_at", { ascending: false })
    .limit(60);

  if (error) throw error;

  // 최근 순서를 지키면서 책별로 한 번씩만
  const candidates: { bookId: string; book: NonNullable<(typeof data)[number]["books"]> }[] = [];
  const seen = new Set<string>();
  for (const row of data ?? []) {
    if (seen.has(row.book_id) || !row.books) continue;
    seen.add(row.book_id);
    candidates.push({ bookId: row.book_id, book: row.books });
  }
  if (candidates.length === 0) return null;

  /*
   * 후보를 하나씩 물어보지 않는다. 완독한 책이 앞에 쌓여 있으면 (완독 → 다음 날
   * 홈 열기 가 흔한 순서다) 책마다 왕복 두 번이 홈 화면 응답에 직렬로 붙는다.
   * 읽은 장 수와 전체 장 수를 각각 한 번에 받아 와서 메모리에서 고른다.
   */
  const [readCounts, chapterRows] = await Promise.all([
    loadPuzzleCounts(supabase, userId),
    supabase
      .from("book_contents")
      .select("book_id")
      .in(
        "book_id",
        candidates.map((c) => c.bookId),
      ),
  ]);

  if (chapterRows.error) throw chapterRows.error;

  const totals: Record<string, number> = {};
  for (const row of chapterRows.data ?? []) {
    totals[row.book_id] = (totals[row.book_id] ?? 0) + 1;
  }

  for (const { bookId, book } of candidates) {
    const totalChapters = totals[bookId] ?? 0;
    const readChapters = readCounts[bookId] ?? 0;
    // 서재 밖 책(본문 없음)과 완독한 책은 "이어서 읽기" 가 아니다
    if (totalChapters === 0 || readChapters >= totalChapters) continue;

    return {
      bookId,
      readChapters,
      totalChapters,
      title: book.title,
      author: book.author,
      coverUrl: book.cover_url,
    };
  }

  return null;
}

/**
 * 학생이 읽은 장 수를 책별로. 서재 화면이 퍼즐을 그리는 데 쓴다.
 *
 * 한 번에 다 읽어 온다 — 목록의 책마다 따로 물어보면 서재 한 장을 여는 데
 * 수십 번 왕복한다. 행 수는 한 학생이 읽은 장의 총합이라 수백 줄을 넘지 않는다.
 * 전체 장 수는 이미 화면에 있다 (reader 의 ShelfBook.chapterCount).
 */
export async function loadPuzzleCounts(
  supabase: BookitClient,
  userId: string,
): Promise<Record<string, number>> {
  const { data, error } = await supabase
    .from("reading_progress")
    .select("book_id")
    .eq("student_id", userId);

  if (error) throw error;

  const counts: Record<string, number> = {};
  for (const row of data ?? []) {
    counts[row.book_id] = (counts[row.book_id] ?? 0) + 1;
  }
  return counts;
}
