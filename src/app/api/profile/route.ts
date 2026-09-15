/**
 * PATCH  /api/profile  { grade_level } → { profile }
 * DELETE /api/profile               → { deleted }   계정과 모든 데이터 삭제, 세션 종료
 *
 * 소유: 김민경 (docs/spec.md §5).
 */

import type { NextRequest, NextResponse } from "next/server";

import { deleteAccount, updateGradeLevel, updateProfileSchema } from "@/modules/auth";
import {
  fail,
  invalidBody,
  ok,
  readJson,
  unauthorized,
} from "@/shared/api";
import { createServerSupabase } from "@/shared/supabase/server";
import type {
  ApiResponse,
  DeleteProfileResponse,
  UpdateProfileResponse,
} from "@/shared/types";

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

export async function DELETE(): Promise<
  NextResponse<ApiResponse<DeleteProfileResponse>>
> {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return unauthorized();

  const result = await deleteAccount(user.id);
  if (!result.ok) return fail(result.code, result.message, result.status);

  // auth.users 가 지워져 토큰은 이미 죽었지만, 브라우저 쿠키는 여기서 걷어낸다
  await supabase.auth.signOut();

  return ok(result.data);
}
