/**
 * POST /api/guardian/link → { url }
 *
 * 소유: 문민재 (docs/spec.md §5).
 * 얇게 유지한다 — 발급은 modules/guardian 이 한다 (CLAUDE.md §2).
 */

import type { NextResponse } from "next/server";

import { createGuardianLink } from "@/modules/guardian/server";
import { fail, ok, unauthorized } from "@/shared/api";
import { createServerSupabase } from "@/shared/supabase/server";
import type { ApiResponse, GuardianLinkResponse } from "@/shared/types";

export async function POST(): Promise<
  NextResponse<ApiResponse<GuardianLinkResponse>>
> {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return unauthorized();

  const result = await createGuardianLink(supabase, user.id);
  if (!result.ok) return fail(result.code, result.message, result.status);

  return ok(result.data);
}
