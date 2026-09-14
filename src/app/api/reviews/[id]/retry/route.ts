/**
 * POST /api/reviews/:id/retry → { verification_id, question, quote, seconds }
 *
 * 소유: 박재경 (docs/spec.md §5).
 *
 * 채점 결과 화면의 "다시 해볼래?" 가 부른다. 항상 새 질문을 만든다 —
 * 같은 질문을 다시 내면 부정행위 방지가 통째로 무너진다 (CLAUDE.md §6).
 * 되도록 아직 안 쓴 빈틈에서 고른다. 그 선택은 issueQuestion 이 한다.
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
    const result = await issueQuestion(supabase, user.id, id, "retry");
    if (!result.ok) return fail(result.code, result.message, result.status);
    return ok(result.data);
  } catch (cause) {
    return serverError("verification:retry", cause);
  }
}
