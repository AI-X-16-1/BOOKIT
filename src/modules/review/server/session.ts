/**
 * review/server/session — /write 화면이 처음 그릴 재료. owner: 박재경
 *
 * 읽기만 한다. 초고를 만드는 건 화면 쪽의 POST /api/reviews 다 — 글쓰기 도우미를
 * 부르려면 초고 id 가 필요해서 작성 화면이 열릴 때 만든다 (components/WriteFlow).
 * 그렇게 생긴 빈 초고는 findResumable 이 걸러서 홈의 "이어서 쓰기"에 뜨지 않는다.
 */
import "server-only";

import type { BookitClient } from "@/shared/supabase";

import { idSchema, type WriteSession } from "../schema";
import { readGaps } from "./gaps";
import { findResumable } from "./reviews";

/**
 * bookId 가 있으면 그 책으로, 없으면 가장 최근에 쓰던 독후감으로 연다.
 * 열 책이 없으면 null — 화면은 "책을 먼저 골라줘"를 보여준다.
 */
export async function loadWriteSession(
  supabase: BookitClient,
  userId: string,
  bookId?: string,
): Promise<WriteSession | null> {
  if (bookId !== undefined && !idSchema.safeParse(bookId).success) return null;

  const review = await findResumable(supabase, userId, bookId);
  const targetBookId = bookId ?? review?.book_id;
  if (!targetBookId) return null;

  const [bookResult, gaps, streakResult] = await Promise.all([
    supabase
      .from("books")
      .select("id, title, author, cover_url")
      .eq("id", targetBookId)
      .maybeSingle(),
    review ? readGaps(supabase, review.id) : Promise.resolve([]),
    // 연속 기록은 growth 모듈 소관이다. 결과 화면의 한 줄에만 쓰므로 읽기만 한다
    supabase
      .from("streaks")
      .select("current_days")
      .eq("student_id", userId)
      .maybeSingle(),
  ]);

  if (bookResult.error) throw bookResult.error;
  if (streakResult.error) throw streakResult.error;
  if (!bookResult.data) return null;

  return {
    book: bookResult.data,
    review,
    gaps,
    streakDays: streakResult.data?.current_days ?? 0,
  };
}
