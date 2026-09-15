/**
 * GET /api/guardian/:token → { summary, books[] }
 *
 * 소유: 문민재 (docs/spec.md §5).
 * 인증 없음 — 계정 없이 토큰 하나로 접근한다 (docs/spec.md §3).
 * 조회는 service role 을 쓰는 modules/guardian/server 가 한다.
 */

import type { NextRequest, NextResponse } from "next/server";

import { getGuardianSummary } from "@/modules/guardian/server";
import { fail, ok } from "@/shared/api";
import type { ApiResponse, GuardianSummaryResponse } from "@/shared/types";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ token: string }> },
): Promise<NextResponse<ApiResponse<GuardianSummaryResponse>>> {
  const { token } = await params;

  const result = await getGuardianSummary(token);
  if (!result.ok) return fail(result.code, result.message, result.status);

  return ok(result.data);
}
