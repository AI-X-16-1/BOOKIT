/**
 * review/server/helper — 글쓰기 도우미(AI #1). owner: 박재경
 *
 * docs/spec.md §5:
 *   POST /api/reviews/:id/helper → { question }
 *
 * 빈 화면 앞에서 얼어붙지 않게 길잡이 질문 하나를 준다. 채점과는 무관한 호출이라
 * 실패해도 작성은 그대로 진행된다 — 화면은 상자만 안 그린다 (ai/server/writing-helper 의 계약).
 *
 * 쓰기 "전" 질문이라 초고일 때만 준다. 제출해서 빈틈이 생긴 뒤에는 본문이 잠기고
 * 화면도 검증으로 넘어가 있어서 물어볼 자리가 없다.
 */
import "server-only";

import { LlmError, writingHelper } from "@/modules/ai";
import type { BookitClient } from "@/shared/supabase";
import type { WritingHelperResult } from "@/shared/types";

import { idSchema } from "../schema";
import { failure, reviewNotFound, type ReviewResult } from "./result";

export async function writeHelperQuestion(
  supabase: BookitClient,
  userId: string,
  reviewId: string,
): Promise<ReviewResult<WritingHelperResult>> {
  if (!idSchema.safeParse(reviewId).success) return reviewNotFound();

  const { data: review, error } = await supabase
    .from("reviews")
    .select("id, student_id, book_id, status")
    .eq("id", reviewId)
    .maybeSingle();

  if (error) throw error;
  // RLS 가 남의 행을 걸러내므로 "없음"과 "남의 것"이 같은 응답이 된다. 의도한 것이다
  if (!review || review.student_id !== userId) return reviewNotFound();

  if (review.status !== "draft") {
    return failure("review_locked", "이미 제출한 독후감이야.", 409);
  }

  const [bookResult, profileResult] = await Promise.all([
    supabase
      .from("books")
      .select("title, author, tags")
      .eq("id", review.book_id)
      .maybeSingle(),
    supabase.from("profiles").select("grade_level").eq("id", userId).maybeSingle(),
  ]);

  if (bookResult.error) throw bookResult.error;
  if (profileResult.error) throw profileResult.error;
  if (!bookResult.data) return failure("book_not_found", "책 정보를 찾을 수 없어.", 404);

  // 질문의 난이도가 학년에 맞춰 잡힌다 (docs/prompts.md §1). 학년을 모르면 아무 학년으로
  // 지어내지 않고 도우미 없이 간다 — 온보딩을 마친 학생에게는 항상 있는 값이다.
  const grade = profileResult.data?.grade_level;
  if (!grade) return failure("grade_unknown", "학년을 먼저 알려줄래?", 409);

  try {
    return { ok: true, data: await writingHelper(bookResult.data, grade) };
  } catch (cause) {
    if (cause instanceof LlmError) {
      // 힌트 하나 때문에 독후감을 못 쓰게 만들지 않는다. 화면은 상자만 뺀다
      console.warn("[review:helper] 글쓰기 도우미 실패", cause);
      return failure("helper_unavailable", "지금은 도우미가 쉬고 있어.", 503);
    }
    throw cause;
  }
}
