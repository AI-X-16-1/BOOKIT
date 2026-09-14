/**
 * GET /api/teacher/class → { class, join_code, stats }
 *
 * 소유: 김민경 (docs/spec.md §5).
 * 얇게 유지한다 — 조회는 modules/teacher 가 한다 (CLAUDE.md §2).
 */

import type { NextResponse } from "next/server";

import { getTeacherClass } from "@/modules/teacher";
import { fail, ok, unauthorized } from "@/shared/api";
import { createServerSupabase } from "@/shared/supabase/server";
import type { ApiResponse, TeacherClassResponse } from "@/shared/types";

export async function GET(): Promise<
  NextResponse<ApiResponse<TeacherClassResponse>>
> {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return unauthorized();

  const result = await getTeacherClass(supabase, user.id);
  if (!result.ok) return fail(result.code, result.message, result.status);

  return ok(result.data);
}
