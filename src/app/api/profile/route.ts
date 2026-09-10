/**
 * PATCH /api/profile  { grade_level } → { profile }
 *
 * 소유: 김민경 (docs/spec.md §5).
 */

import type { NextRequest, NextResponse } from "next/server";

import { updateGradeLevel, updateProfileSchema } from "@/modules/auth";
import {
  fail,
  invalidBody,
  ok,
  readJson,
  unauthorized,
} from "@/shared/api";
import { createServerSupabase } from "@/shared/supabase/server";
import type { ApiResponse, UpdateProfileResponse } from "@/shared/types";

export async function PATCH(
  request: NextRequest,
): Promise<NextResponse<ApiResponse<UpdateProfileResponse>>> {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return unauthorized();

  const parsed = updateProfileSchema.safeParse(await readJson(request));
  if (!parsed.success) return invalidBody("학년을 다시 골라줘.");

  const result = await updateGradeLevel(
    supabase,
    user.id,
    parsed.data.grade_level,
  );
  if (!result.ok) return fail(result.code, result.message, result.status);

  return ok({ profile: result.data });
}
