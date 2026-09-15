/**
 * POST /api/points/exchange { kind } → { balance, voucher_url }
 *
 * 소유: 문민재 (docs/spec.md §5).
 * 얇게 유지한다 — 잔액 확인과 차감은 exchange_points RPC(0009) 가 한 트랜잭션으로 한다.
 */

import type { NextRequest, NextResponse } from "next/server";

import { exchangeSchema } from "@/modules/rewards";
import { exchangePoints } from "@/modules/rewards/server";
import {
  fail,
  invalidBody,
  ok,
  readJson,
  serverError,
  unauthorized,
} from "@/shared/api";
import { createServerSupabase } from "@/shared/supabase/server";
import type { ApiResponse, ExchangeResponse } from "@/shared/types";

export async function POST(
  request: NextRequest,
): Promise<NextResponse<ApiResponse<ExchangeResponse>>> {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return unauthorized();

  const parsed = exchangeSchema.safeParse(await readJson(request));
  if (!parsed.success) return invalidBody();

  try {
    const result = await exchangePoints(user.id, parsed.data.kind);
    if (!result.ok) return fail(result.code, result.message, result.status);
    return ok(result.data);
  } catch (cause) {
    return serverError("rewards:exchange", cause);
  }
}
