/**
 * review/server/reviews — 초고 만들기와 자동 저장. owner: 박재경
 *
 * docs/spec.md §5:
 *   POST  /api/reviews      { book_id } → { review }  (draft)
 *   PATCH /api/reviews/:id  { body }    → { review }  자동 저장, 2s 디바운스
 *
 * 전부 로그인한 학생 본인 권한으로 한다. reviews 는 "본인 행만" 정책이라(0003)
 * 남의 독후감 id 를 넣으면 그냥 없는 것으로 나온다.
 */
import "server-only";

import type { BookitClient } from "@/shared/supabase";
import type {
  CreateReviewResponse,
  Review,
  ReviewStatus,
  UpdateReviewResponse,
} from "@/shared/types";

import { idSchema } from "../schema";
import { failure, reviewNotFound, type ReviewResult } from "./result";

/**
 * 이어서 할 수 있는 독후감. 통과한 건 끝난 것이라 빠진다 — 다시 읽으면 새 행이다 (spec §2).
 *
 * failed 가 들어가는 이유: 0003 의 활성 유니크 인덱스는 failed 를 활성으로 치지 않지만,
 * 실패한 독후감은 재시도로 이어져야 한다. 여기서 빼면 같은 책으로 초고가 하나 더 생긴다.
 */
const RESUMABLE: ReviewStatus[] = ["draft", "analyzing", "questioning", "failed"];

/** 본문을 고칠 수 있는 상태. 빈틈이 생긴 뒤에는 인용문이 본문과 어긋나므로 잠근다 */
const EDITABLE: ReviewStatus[] = ["draft", "analyzing"];

/**
 * analyzing 은 "빈틈 분석이 도는 중"이라 그동안은 본문을 잠근다.
 * 그런데 함수가 중간에 죽으면 analyzing 이 영영 남는다. 이 시간이 지난 analyzing 은
 * 버려진 잠금으로 보고 다시 초고로 돌린다. LLM 타임아웃보다 넉넉하게 잡는다.
 */
const STALE_ANALYZING_MS = 90_000;

/**
 * 이어서 쓸 독후감을 찾는다. 쓰던 초고가 먼저고, 없으면 가장 최근에 손댄 것.
 * bookId 가 없으면 책과 상관없이 찾는다 — 홈의 "이어서 쓰기" 가 이 경로다.
 */
export async function findResumable(
  supabase: BookitClient,
  userId: string,
  bookId?: string,
): Promise<Review | null> {
  let query = supabase
    .from("reviews")
    .select("*")
    .eq("student_id", userId)
    .in("status", RESUMABLE);
  if (bookId) query = query.eq("book_id", bookId);

  const { data, error } = await query
    .order("updated_at", { ascending: false })
    .limit(20);

  if (error) throw error;
  const rows = data ?? [];
  return rows.find((row) => EDITABLE.includes(row.status)) ?? rows[0] ?? null;
}

/**
 * POST /api/reviews
 *
 * 이 책으로 쓰던 독후감이 있으면 그걸 돌려주고, 없을 때만 새로 만든다.
 * 탭 두 개에서 열거나 버튼을 두 번 눌러도 초고가 하나로 유지된다.
 */
export async function openReview(
  supabase: BookitClient,
  userId: string,
  bookId: string,
): Promise<ReviewResult<CreateReviewResponse>> {
  const { data: book, error: bookError } = await supabase
    .from("books")
    .select("id")
    .eq("id", bookId)
    .maybeSingle();

  if (bookError) throw bookError;
  if (!book) return failure("book_not_found", "그 책을 찾을 수 없어.", 404);

  const resumable = await findResumable(supabase, userId, bookId);
  if (resumable) return { ok: true, data: { review: resumable } };

  const { data: created, error } = await supabase
    .from("reviews")
    .insert({ student_id: userId, book_id: bookId })
    .select("*")
    .single();

  if (error) {
    // reviews_one_active_per_student_book (0003). 동시에 들어온 요청이 먼저 만들었다
    if (error.code === "23505") {
      const winner = await findResumable(supabase, userId, bookId);
      if (winner) return { ok: true, data: { review: winner } };
    }
    throw error;
  }

  return { ok: true, data: { review: created } };
}

/**
 * PATCH /api/reviews/:id
 *
 * 초고일 때만 저장한다. 제출해서 빈틈이 생긴 뒤에 본문이 바뀌면 빈틈 인용문이
 * 본문에서 사라져 하이라이트도, 질문의 근거도 깨진다.
 * 조건부 update 한 번으로 상태 확인과 저장을 같이 한다 — 읽고 나서 쓰면 그 사이에 제출이 끼어든다.
 */
export async function saveDraft(
  supabase: BookitClient,
  userId: string,
  reviewId: string,
  body: string,
): Promise<ReviewResult<UpdateReviewResponse>> {
  if (!idSchema.safeParse(reviewId).success) return reviewNotFound();

  const now = new Date();
  const staleBefore = new Date(now.getTime() - STALE_ANALYZING_MS).toISOString();

  const { data: saved, error } = await supabase
    .from("reviews")
    .update({
      body,
      // Postgres length() 와 맞춘다 — 코드 포인트 기준
      char_count: Array.from(body).length,
      // status 는 보내지 않는다 — 0009 가 학생 역할에서 그 컬럼을 걷었다.
      // 아래 .or() 가 draft(또는 오래된 analyzing)만 고르므로 상태를 되돌릴 필요도 없다.
      updated_at: now.toISOString(),
    })
    .eq("id", reviewId)
    .eq("student_id", userId)
    .or(`status.eq.draft,and(status.eq.analyzing,updated_at.lt."${staleBefore}")`)
    .select("*")
    .maybeSingle();

  if (error) throw error;
  if (saved) return { ok: true, data: { review: saved } };

  // 저장이 안 됐다. 없는 독후감인지, 잠긴 독후감인지 가려서 알려준다
  const { data: existing, error: readError } = await supabase
    .from("reviews")
    .select("status")
    .eq("id", reviewId)
    .maybeSingle();

  if (readError) throw readError;
  if (!existing) return reviewNotFound();

  return failure(
    "review_locked",
    existing.status === "analyzing"
      ? "빈틈을 찾는 중이라 지금은 고칠 수 없어."
      : "이미 제출한 독후감이야.",
    409,
  );
}
