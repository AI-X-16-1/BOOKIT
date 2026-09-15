/**
 * GET /api/ranking/class → { my_class, rows[] }
 *
 * 소유: 문민재 (docs/spec.md §5).
 * 얇게 유지한다 — 집계는 modules/ranking 이 한다 (CLAUDE.md §2).
 */

import type { NextResponse } from "next/server";

import { getClassRanking } from "@/modules/ranking";
import { fail, ok, unauthorized } from "@/shared/api";
import { createServerSupabase } from "@/shared/supabase/server";
import type { ApiResponse, ClassRankingResponse } from "@/shared/types";

export async function GET(): Promise<
  NextResponse<ApiResponse<ClassRankingResponse>>
> {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return unauthorized();

  const result = await getClassRanking(supabase, user.id);
  if (!result.ok) return fail(result.code, result.message, result.status);

  return ok(result.data);
}
