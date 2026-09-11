/**
 * POST /api/reviews/:id/submit → { gaps[] }
 *
 * 소유: 박재경 (docs/spec.md §5).
 * 얇게 유지한다 — 판단은 modules/review 의 submitReview 가 한다 (CLAUDE.md §2).
 *
 * AI #2 빈틈 분석을 돌린다. 질문(AI #3)은 화면이 빈틈을 받자마자
 * POST /api/reviews/:id/question 으로 미리 만든다 — 이유는 submitReview 주석 참고.
 */

import type { NextRequest, NextResponse } from "next/server";

import { submitReview } from "@/modules/review/server";
import { fail, ok, serverError, unauthorized } from "@/shared/api";
import { createServerSupabase } from "@/shared/supabase/server";
import type { ApiResponse, SubmitReviewResponse } from "@/shared/types";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse<ApiResponse<SubmitReviewResponse>>> {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return unauthorized();

  const { id } = await params;

  try {
    const result = await submitReview(supabase, user.id, id);
    if (!result.ok) return fail(result.code, result.message, result.status);
    return ok(result.data);
  } catch (cause) {
    return serverError("review:submit", cause);
  }
}
