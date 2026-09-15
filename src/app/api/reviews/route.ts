/**
 * POST /api/reviews  { book_id } → { review }
 *
 * 소유: 박재경 (docs/spec.md §5).
 * 얇게 유지한다 — 판단은 modules/review 의 openReview 가 한다 (CLAUDE.md §2).
 *
 * 이 책으로 쓰던 독후감이 있으면 새로 만들지 않고 그걸 돌려준다.
 */

import type { NextRequest, NextResponse } from "next/server";

import { createReviewSchema } from "@/modules/review";
import { openReview } from "@/modules/review/server";
import {
  fail,
  invalidBody,
  ok,
  readJson,
  serverError,
  unauthorized,
} from "@/shared/api";
import { createServerSupabase } from "@/shared/supabase/server";
import type { ApiResponse, CreateReviewResponse } from "@/shared/types";

export async function POST(
  request: NextRequest,
): Promise<NextResponse<ApiResponse<CreateReviewResponse>>> {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return unauthorized();

  const parsed = createReviewSchema.safeParse(await readJson(request));
  if (!parsed.success) return invalidBody("어떤 책인지 알 수 없어.");

  try {
    const result = await openReview(supabase, user.id, parsed.data.book_id);
    if (!result.ok) return fail(result.code, result.message, result.status);
    return ok(result.data);
  } catch (cause) {
    return serverError("review:create", cause);
  }
}
