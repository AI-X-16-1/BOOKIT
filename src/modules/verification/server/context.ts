/**
 * verification/server/context — 검증 한 판에 필요한 것들을 모아 온다. owner: 박재경
 *
 * 질문 발급과 채점이 같은 재료를 쓴다: 독후감 본문, 책, 빈틈 목록, 지금까지의 시도.
 * 읽기는 전부 로그인한 학생 본인 권한으로 한다 — RLS 를 우회하지 않는다.
 * reviews / review_gaps / verifications 모두 "본인 행만" 정책이라, 남의 독후감
 * id 를 찍어 넣으면 여기서 그냥 없는 것으로 나온다 (0003).
 */
import "server-only";

import type { BookitClient } from "@/shared/supabase";
import type { BookContext, GradeLevel, Review, ReviewGap, Verification } from "@/shared/types";

import { failure, type VerificationResult } from "./result";

/** 채점·질문 생성에 필요한 시도 이력. 전체 컬럼을 끌고 오지 않는다. */
export type AttemptSummary = Pick<
  Verification,
  "id" | "attempt_no" | "gap_id" | "question" | "answered_at" | "passed" | "asked_at"
>;

export interface VerificationContext {
  review: Pick<Review, "id" | "student_id" | "body" | "status" | "book_id">;
  book: BookContext;
  gradeLevel: GradeLevel | undefined;
  /** ord 오름차순. ord 1 이 가장 중요한 빈틈이다 */
  gaps: ReviewGap[];
  /** attempt_no 오름차순 */
  attempts: AttemptSummary[];
}

const ATTEMPT_COLUMNS =
  "id, attempt_no, gap_id, question, answered_at, passed, asked_at" as const;

/**
 * 독후감 하나를 검증할 준비가 됐는지 확인하고 재료를 모은다.
 *
 * 빈틈이 없으면 물어볼 것도 없다. 잘 쓴 독후감이라 빈틈이 0개인 경우는
 * 제출 시점에 통과 처리되어야 하고(docs/prompts.md §2), 여기까지 오면 안 된다 —
 * 그래서 오류로 돌린다.
 */
export async function loadContext(
  supabase: BookitClient,
  userId: string,
  reviewId: string,
): Promise<VerificationResult<VerificationContext>> {
  const { data: review, error: reviewError } = await supabase
    .from("reviews")
    .select("id, student_id, body, status, book_id")
    .eq("id", reviewId)
    .maybeSingle();

  if (reviewError) throw reviewError;
  // RLS 가 남의 행을 걸러내므로 "없음"과 "남의 것"이 같은 응답이 된다. 의도한 것이다
  if (!review || review.student_id !== userId) {
    return failure("review_not_found", "그 독후감을 찾을 수 없어.", 404);
  }
  if (!review.body.trim()) {
    return failure("review_empty", "독후감을 먼저 써줘.", 409);
  }

  const [bookResult, gapsResult, attemptsResult, profileResult] = await Promise.all([
    supabase
      .from("books")
      .select("title, author, tags")
      .eq("id", review.book_id)
      .maybeSingle(),
    supabase
      .from("review_gaps")
      .select("*")
      .eq("review_id", reviewId)
      .order("ord", { ascending: true }),
    supabase
      .from("verifications")
      .select(ATTEMPT_COLUMNS)
      .eq("review_id", reviewId)
      .order("attempt_no", { ascending: true }),
    supabase.from("profiles").select("grade_level").eq("id", userId).maybeSingle(),
  ]);

  if (bookResult.error) throw bookResult.error;
  if (gapsResult.error) throw gapsResult.error;
  if (attemptsResult.error) throw attemptsResult.error;
  if (profileResult.error) throw profileResult.error;

  if (!bookResult.data) {
    return failure("book_not_found", "책 정보를 찾을 수 없어.", 404);
  }

  const gaps = gapsResult.data ?? [];
  if (gaps.length === 0) {
    return failure(
      "gaps_not_ready",
      "빈틈 분석이 아직 안 끝났어. 조금만 기다려줄래?",
      409,
    );
  }

  return {
    ok: true,
    data: {
      review,
      book: bookResult.data,
      gradeLevel: profileResult.data?.grade_level ?? undefined,
      gaps,
      attempts: attemptsResult.data ?? [],
    },
  };
}
