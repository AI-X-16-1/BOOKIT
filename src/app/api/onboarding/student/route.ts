/**
 * POST /api/onboarding/student  { grade_level, join_code } → { class }
 *
 * 소유: 김민경 (docs/spec.md §5).
 * 얇게 유지한다 — 판단은 modules/auth 의 joinClassByCode 가 한다 (CLAUDE.md §2).
 */

import type { NextRequest, NextResponse } from "next/server";

import { joinClassByCode, studentOnboardingSchema } from "@/modules/auth";
import {
  fail,
  invalidBody,
  ok,
  readJson,
  unauthorized,
} from "@/shared/api";
import { createServerSupabase } from "@/shared/supabase/server";
import type { ApiResponse, StudentOnboardingResponse } from "@/shared/types";

export async function POST(
  request: NextRequest,
): Promise<NextResponse<ApiResponse<StudentOnboardingResponse>>> {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return unauthorized();

  const parsed = studentOnboardingSchema.safeParse(await readJson(request));
  if (!parsed.success) return invalidBody("6자리 코드와 학년을 확인해줘.");

  const result = await joinClassByCode(supabase, user.id, parsed.data);
  if (!result.ok) return fail(result.code, result.message, result.status);

  return ok({ class: result.data });
}
