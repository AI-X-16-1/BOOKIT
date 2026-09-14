/**
 * PATCH /api/reviews/:id  { body } → { review }
 *
 * 소유: 박재경 (docs/spec.md §5).
 * 에디터의 자동 저장이 2초 디바운스로 부른다. 초고일 때만 저장된다 —
 * 제출한 뒤에는 409 review_locked.
 */

import type { NextRequest, NextResponse } from "next/server";

import { updateReviewSchema } from "@/modules/review";
import { saveDraft } from "@/modules/review/server";
import {
  fail,
  invalidBody,
  ok,
  readJson,
  serverError,
  unauthorized,
} from "@/shared/api";
import { createServerSupabase } from "@/shared/supabase/server";
import type { ApiResponse, UpdateReviewResponse } from "@/shared/types";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse<ApiResponse<UpdateReviewResponse>>> {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return unauthorized();

  const parsed = updateReviewSchema.safeParse(await readJson(request));
  if (!parsed.success) return invalidBody("독후감이 너무 길어. 조금만 줄여줄래?");

  const { id } = await params;

  try {
    const result = await saveDraft(supabase, user.id, id, parsed.data.body);
    if (!result.ok) return fail(result.code, result.message, result.status);
    return ok(result.data);
  } catch (cause) {
    return serverError("review:save", cause);
  }
}
