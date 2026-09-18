/**
 * POST /api/items/:id/buy → { balance, owned[] }
 *
 * 아이템 구매 (④, docs/spec.md §5b). 소유: 문민재.
 * 얇게 유지한다 — 잔액 확인·차감·지급은 buy_item RPC(0016)가 한 트랜잭션으로 한다.
 *
 * 가격을 본문으로 받지 않는다. RPC 가 items 에서만 읽는다 (클라이언트가 값을 못 정한다).
 */
import type { NextResponse } from "next/server";

import { buyItem } from "@/modules/rewards/server";
import { fail, invalidBody, ok, serverError, unauthorized } from "@/shared/api";
import { createServerSupabase } from "@/shared/supabase/server";
import type { ApiResponse, BuyItemResponse } from "@/shared/types";

/** uuid 모양만 본다 — Postgres 가 22P02 로 터지지 않게 (reader 의 readingProgressSchema 와 같다) */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(
  _request: Request,
  { params }: RouteContext<"/api/items/[id]/buy">,
): Promise<NextResponse<ApiResponse<BuyItemResponse>>> {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return unauthorized();

  const { id } = await params;
  if (!UUID.test(id)) return invalidBody("그런 아이템을 찾을 수 없어.");

  try {
    const result = await buyItem(supabase, user.id, id);
    if (!result.ok) return fail(result.code, result.message, result.status);
    return ok(result.data);
  } catch (cause) {
    return serverError("rewards:buy", cause);
  }
}
