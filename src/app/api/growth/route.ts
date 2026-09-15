/**
 * GET /api/growth → { streak, tree_stage, leaves, stamps[] }
 *
 * 소유: 문민재 (docs/spec.md §5).
 * 얇게 유지한다 — 조회는 modules/growth 가 한다 (CLAUDE.md §2).
 */

import type { NextResponse } from "next/server";

import { getGrowth } from "@/modules/growth";
import { fail, ok, unauthorized } from "@/shared/api";
import { createServerSupabase } from "@/shared/supabase/server";
import type { ApiResponse, GrowthResponse } from "@/shared/types";

export async function GET(): Promise<NextResponse<ApiResponse<GrowthResponse>>> {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return unauthorized();

  const result = await getGrowth(supabase, user.id);
  if (!result.ok) return fail(result.code, result.message, result.status);

  return ok(result.data);
}
