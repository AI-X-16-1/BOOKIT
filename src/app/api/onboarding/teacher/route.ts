/**
 * POST /api/onboarding/teacher  { school_name, grade_level, class_no } → { class, join_code }
 *
 * 소유: 김민경 (docs/spec.md §5).
 */

import type { NextRequest, NextResponse } from "next/server";

import { createClassForTeacher, teacherOnboardingSchema } from "@/modules/auth";
import {
  fail,
  invalidBody,
  ok,
  readJson,
  unauthorized,
} from "@/shared/api";
import { createServerSupabase } from "@/shared/supabase/server";
import type { ApiResponse, TeacherOnboardingResponse } from "@/shared/types";

export async function POST(
  request: NextRequest,
): Promise<NextResponse<ApiResponse<TeacherOnboardingResponse>>> {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return unauthorized();

  const parsed = teacherOnboardingSchema.safeParse(await readJson(request));
  if (!parsed.success) return invalidBody("학교와 반을 확인해주세요.");

  const result = await createClassForTeacher(supabase, user.id, parsed.data);
  if (!result.ok) return fail(result.code, result.message, result.status);

  return ok(result.data);
}
