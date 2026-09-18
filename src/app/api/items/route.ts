/**
 * GET /api/items → { items[], balance }
 *
 * 아이템 샵 카탈로그 (④, docs/spec.md §5b). 소유: 문민재.
 * 얇게 유지한다 — 조회는 modules/rewards 가 한다 (CLAUDE.md §2).
 */
import type { NextResponse } from "next/server";

import { listItems } from "@/modules/rewards/server";
import { fail, ok, serverError, unauthorized } from "@/shared/api";
import { createServerSupabase } from "@/shared/supabase/server";
import type { ApiResponse, ItemsResponse } from "@/shared/types";

export async function GET(): Promise<NextResponse<ApiResponse<ItemsResponse>>> {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return unauthorized();

  try {
    const result = await listItems(supabase, user.id);
    if (!result.ok) return fail(result.code, result.message, result.status);
    return ok(result.data);
  } catch (cause) {
    return serverError("rewards:items", cause);
  }
}
