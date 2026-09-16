/**
 * POST /api/reviews/:id/helper → { question }
 *
 * 소유: 박재경 (docs/spec.md §5).
 * 얇게 유지한다 — 판단은 modules/review 의 writeHelperQuestion 이 한다 (CLAUDE.md §2).
 *
 * AI #1 글쓰기 도우미. 실패는 작성을 막지 않는다 — 화면이 상자를 안 그린다.
 */

import type { NextRequest, NextResponse } from "next/server";

import { writeHelperQuestion } from "@/modules/review/server";
import { fail, ok, serverError, unauthorized } from "@/shared/api";
import { createServerSupabase } from "@/shared/supabase/server";
import type { ApiResponse, WritingHelperResult } from "@/shared/types";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse<ApiResponse<WritingHelperResult>>> {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return unauthorized();

  const { id } = await params;

  try {
    const result = await writeHelperQuestion(supabase, user.id, id);
    if (!result.ok) return fail(result.code, result.message, result.status);
    return ok(result.data);
  } catch (cause) {
    return serverError("review:helper", cause);
  }
}
