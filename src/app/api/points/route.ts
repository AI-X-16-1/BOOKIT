/**
 * GET /api/points → { balance, ledger[] }
 *
 * 소유: 문민재 (docs/spec.md §5).
 * 얇게 유지한다 — 조회는 modules/rewards 가 한다 (CLAUDE.md §2).
 */

import type { NextResponse } from "next/server";

import { getPoints } from "@/modules/rewards/server";
import { fail, ok, unauthorized } from "@/shared/api";
import { createServerSupabase } from "@/shared/supabase/server";
import type { ApiResponse, PointsResponse } from "@/shared/types";

export async function GET(): Promise<NextResponse<ApiResponse<PointsResponse>>> {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return unauthorized();

  const result = await getPoints(supabase, user.id);
  if (!result.ok) return fail(result.code, result.message, result.status);

  return ok(result.data);
}
