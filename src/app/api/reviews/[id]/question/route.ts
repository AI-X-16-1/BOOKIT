/**
 * POST /api/reviews/:id/question → { verification_id, question, quote, seconds }
 *
 * 소유: 박재경 (docs/spec.md §5).
 * 얇게 유지한다 — 판단은 modules/verification 의 issueQuestion 이 한다 (CLAUDE.md §2).
 *
 * 화면은 빈틈 분석을 보여주는 동안 이걸 부른다. 응답이 돌아온 순간이 곧
 * asked_at 이고, 카운트다운은 질문이 화면에 뜬 뒤에 시작한다 (CLAUDE.md §6).
 */

import type { NextRequest, NextResponse } from "next/server";

import { issueQuestion } from "@/modules/verification/server";
import { fail, ok, serverError, unauthorized } from "@/shared/api";
import { createServerSupabase } from "@/shared/supabase/server";
import type { ApiResponse, QuestionResponse } from "@/shared/types";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse<ApiResponse<QuestionResponse>>> {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return unauthorized();

  const { id } = await params;

  try {
    const result = await issueQuestion(supabase, user.id, id, "first");
    if (!result.ok) return fail(result.code, result.message, result.status);
    return ok(result.data);
  } catch (cause) {
    return serverError("verification:question", cause);
  }
}
