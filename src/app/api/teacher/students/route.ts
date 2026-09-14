/**
 * GET /api/teacher/students → { rows[] }
 *
 * 소유: 김민경 (docs/spec.md §5).
 * rows[] 에는 독후감 본문이 절대 들어가지 않는다 (CLAUDE.md §5).
 */

import type { NextResponse } from "next/server";

import { getStudentRows, ownedClass } from "@/modules/teacher";
import { fail, ok, unauthorized } from "@/shared/api";
import { createServerSupabase } from "@/shared/supabase/server";
import type { ApiResponse, TeacherStudentsResponse } from "@/shared/types";

export async function GET(): Promise<
  NextResponse<ApiResponse<TeacherStudentsResponse>>
> {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return unauthorized();

  const klass = await ownedClass(supabase, user.id);
  if (!klass.ok) return fail(klass.code, klass.message, klass.status);

  const result = await getStudentRows(supabase, klass.data.id);
  if (!result.ok) return fail(result.code, result.message, result.status);

  return ok({ rows: result.data });
}
