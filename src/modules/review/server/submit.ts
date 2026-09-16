/**
 * review/server/submit — 독후감 제출과 빈틈 분석. owner: 박재경
 *
 * docs/spec.md §5:
 *   POST /api/reviews/:id/submit → { gaps[] }
 *
 * AI #2(빈틈 분석)를 돌려 review_gaps 에 저장한다.
 * 빈틈이 0개면 AI #2b(핵심 문장 고르기)로 한 문장을 골라 core_claim 빈틈으로 저장한다 —
 * 검증을 건너뛰지 않는다 (issue #14, docs/prompts.md §2).
 *
 * AI #3(질문)은 여기서 만들지 않는다. spec 은 "submit 이 미리 만든다"고 적었지만,
 * 그러면 학생이 빈틈 화면을 보기 전에 LLM 호출 두 번을 연달아 기다려야 한다.
 * 대신 화면이 빈틈을 받자마자 POST /api/reviews/:id/question 을 뒤에서 한 번 불러
 * 질문을 만들어 두고, "질문 받고 답하기"를 누르면 같은 라우트를 다시 불러
 * asked_at 만 새로 찍는다 (verification/server/question 의 restamp).
 * 결과는 같다 — 질문은 빈틈 화면을 보는 동안 만들어지고, 타이머는 질문이 뜬 뒤 시작한다
 * (CLAUDE.md §6).
 */
import "server-only";

import { analyzeGaps, LlmError, pickCoreClaim } from "@/modules/ai";
import type { BookitClient } from "@/shared/supabase";
import { createAdminClient } from "@/shared/supabase/admin";
import type { Gap, ReviewStatus, SubmitReviewResponse } from "@/shared/types";

import { idSchema, MIN_SUBMIT_CHARS } from "../schema";
import { readGaps, toGapView } from "./gaps";
import { failure, reviewNotFound, type ReviewResult } from "./result";

export async function submitReview(
  supabase: BookitClient,
  userId: string,
  reviewId: string,
): Promise<ReviewResult<SubmitReviewResponse>> {
  if (!idSchema.safeParse(reviewId).success) return reviewNotFound();

  const { data: review, error } = await supabase
    .from("reviews")
    .select("id, student_id, book_id, body, status")
    .eq("id", reviewId)
    .maybeSingle();

  if (error) throw error;
  // RLS 가 남의 행을 걸러내므로 "없음"과 "남의 것"이 같은 응답이 된다. 의도한 것이다
  if (!review || review.student_id !== userId) return reviewNotFound();

  // 이미 분석이 끝났으면 그대로 돌려준다. 새로 고침이나 버튼 두 번 누르기에
  // LLM 을 다시 부르지 않고, 빈틈이 바뀌어 진행 중인 질문의 근거가 사라지지도 않는다
  const existing = await readGaps(supabase, reviewId);
  if (existing.length > 0) return { ok: true, data: { gaps: existing } };

  if (review.status !== "draft" && review.status !== "analyzing") {
    return failure("review_locked", "이미 제출한 독후감이야.", 409);
  }
  if (review.body.trim().length < MIN_SUBMIT_CHARS) {
    return failure("review_too_short", "조금만 더 써줄래?", 409);
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

  // 분석이 도는 동안 본문을 잠근다 (saveDraft 가 analyzing 을 거절한다)
  await setStatus(supabase, reviewId, "analyzing");

  const gradeLevel = profileResult.data?.grade_level ?? undefined;

  let found: Gap[];
  try {
    ({ gaps: found } = await analyzeGaps(review.body, bookResult.data, { gradeLevel }));

    if (found.length === 0) {
      // 빈틈이 0개라고 질문을 건너뛰지 않는다 (issue #14, 2026-09-15 결정).
      // 잘 쓴 독후감일수록 빈틈이 0개로 나오는데(채점 기준 실측 5건 중 4건), 거기서 검증을
      // 건너뛰면 대필한 글이 부정행위 방지 장치를 통째로 피한다. 대신 학생의 핵심 판단
      // 한 문장을 골라 core_claim 빈틈으로 저장하고(0013) 평소 흐름을 그대로 태운다.
      console.info(`[review:submit] 빈틈 0개 — core_claim 으로 질문한다. review ${reviewId}`);
      const claim = await pickCoreClaim(review.body, bookResult.data, { gradeLevel });
      if (claim) found = [claim];
    }
  } catch (cause) {
    // 잠금을 풀어 학생이 계속 고치거나 다시 낼 수 있게 한다
    await setStatus(supabase, reviewId, "draft");
    if (cause instanceof LlmError) {
      console.error("[review:submit] 빈틈 분석 실패", cause);
      return failure(
        "analysis_unavailable",
        "빈틈을 찾다가 멈췄어. 잠깐 뒤에 다시 해볼까?",
        503,
      );
    }
    throw cause;
  }

  if (found.length === 0) {
    // 빈틈도 없고 되물을 문장도 못 골랐다 — 모델이 고른 문장이 독후감 원문에 없어
    // pickCoreClaim 이 null 을 돌려준 경우다 (ai/server/core-claim 의 resolveQuote).
    // 원문에 없는 문장을 하이라이트할 수는 없으니 초고로 돌려 한 줄 더 쓰게 한다.
    console.info(`[review:submit] 빈틈 0개 + 핵심 문장도 못 고름 — review ${reviewId}`);
    await setStatus(supabase, reviewId, "draft");
    return { ok: true, data: { gaps: [] } };
  }

  const { data: inserted, error: insertError } = await supabase
    .from("review_gaps")
    .insert(
      found.map((gap, index) => ({
        review_id: reviewId,
        ord: index + 1,
        quote: gap.quote,
        gap_type: gap.type,
        reason: gap.reason,
      })),
    )
    .select("*")
    .order("ord", { ascending: true });

  if (insertError) {
    // unique (review_id, ord). 동시에 들어온 제출이 먼저 저장했다 — 그쪽 결과를 쓴다
    if (insertError.code === "23505") {
      return { ok: true, data: { gaps: await readGaps(supabase, reviewId) } };
    }
    throw insertError;
  }

  await setStatus(supabase, reviewId, "questioning");
  return { ok: true, data: { gaps: (inserted ?? []).map(toGapView) } };
}

/**
 * 상태 전이는 admin 으로 쓴다 — 0009 가 학생 역할에서 reviews.status 컬럼을 걷었다.
 * 소유권은 submitReview 첫머리에서 사용자 세션으로 이미 확인했다.
 * supabase 인자는 호출부 모양을 유지하려고 남겨 둔다.
 */
async function setStatus(
  _supabase: BookitClient,
  reviewId: string,
  status: ReviewStatus,
): Promise<void> {
  const { error } = await createAdminClient()
    .from("reviews")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", reviewId);

  if (error) throw error;
}
