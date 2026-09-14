/**
 * GET /api/teacher/ranking → { rows[] }
 *
 * 소유: 김민경 (docs/spec.md §5).
 * 반 단위 집계만 돌려준다. 학생 개인 순위는 만들지 않는다 (docs/plan.md §4).
 */

import type { NextResponse } from "next/server";

import { getClassRanking } from "@/modules/teacher";
import { fail, ok, unauthorized } from "@/shared/api";
import { createServerSupabase } from "@/shared/supabase/server";
import type { ApiResponse, TeacherRankingResponse } from "@/shared/types";

export async function GET(): Promise<
  NextResponse<ApiResponse<TeacherRankingResponse>>
> {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return unauthorized();

  const result = await getClassRanking(supabase);
  if (!result.ok) return fail(result.code, result.message, result.status);

  return ok({ rows: result.data });
}
