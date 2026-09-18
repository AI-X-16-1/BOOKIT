/**
 * rewards/server/items — 아이템 샵 (④). owner: 문민재 (파일은 박재경이 추가)
 *
 * docs/spec.md §2b·§5b:
 *   GET  /api/items            → { items[], balance }
 *   POST /api/items/:id/buy    → { balance, owned[] }
 *
 * 스키마·RPC 는 0016 에 이미 깔려 있고 여기는 화면에 필요한 조회와 구매 호출만 한다.
 *
 * 구매는 **buy_item RPC 한 번**이다 — 잔액 확인·차감·지급이 한 트랜잭션이고
 * 같은 학생의 동시 구매는 advisory lock 으로 직렬화된다 (exchange_points 와 같은 방식).
 * 여기서 잔액을 먼저 읽어 보고 막지 않는다. 읽고 나서 사는 사이에 잔액이 바뀔 수 있고,
 * 그 판단은 트랜잭션 안에서만 맞다. **points_ledger 는 append-only 그대로다** (§4 불변).
 *
 * 가격은 클라이언트에서 받지 않는다 — RPC 가 items 에서만 읽는다.
 */
import "server-only";

import type { BookitClient } from "@/shared/supabase";
import { createAdminClient } from "@/shared/supabase/admin";
import type { BuyItemResponse, ItemsResponse } from "@/shared/types";

import { getPoints, type RewardsResult } from "./points";

const SERVER_ERROR = "잠깐 문제가 생겼어. 다시 해볼까?";

const failure = (
  code: string,
  message: string,
  status: number,
): RewardsResult<never> => ({ ok: false, code, message, status });

/** 내가 가진 아이템 id */
async function ownedIds(supabase: BookitClient, userId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from("student_items")
    .select("item_id")
    .eq("student_id", userId);

  if (error) throw error;
  return (data ?? []).map((row) => row.item_id);
}

/**
 * 카탈로그 + 내가 가진 것 + 잔액.
 *
 * 카탈로그는 누구나 읽는다 (0016 `items_select_all`), 가진 것은 본인 행만
 * (`student_items_select_own`). 그래서 남이 뭘 샀는지는 보이지 않는다.
 */
export async function listItems(
  supabase: BookitClient,
  userId: string,
): Promise<RewardsResult<ItemsResponse>> {
  const [catalog, owned, points] = await Promise.all([
    supabase.from("items").select("*").order("price", { ascending: true }),
    ownedIds(supabase, userId),
    getPoints(supabase, userId),
  ]);

  if (catalog.error) {
    console.error("[rewards] 아이템 카탈로그 조회 실패", catalog.error);
    return failure("server_error", SERVER_ERROR, 500);
  }
  if (!points.ok) return points;

  const mine = new Set(owned);

  return {
    ok: true,
    data: {
      items: (catalog.data ?? []).map((item) => ({ ...item, owned: mine.has(item.id) })),
      balance: points.data.balance,
    },
  };
}

/**
 * 한 개 산다.
 *
 * 실패는 세 가지고 셋 다 RPC 가 errcode 로 구분해 준다 (0016):
 *   P0002 no_data_found   → 그런 아이템이 없다
 *   23505 unique_violation → 이미 가졌다
 *   23514 check_violation  → 책갈피가 모자라다
 * 그 밖은 예상 못 한 실패라 서버 오류로 접는다.
 */
export async function buyItem(
  supabase: BookitClient,
  userId: string,
  itemId: string,
): Promise<RewardsResult<BuyItemResponse>> {
  const { error } = await createAdminClient().rpc("buy_item", {
    p_student_id: userId,
    p_item_id: itemId,
  });

  if (error) {
    if (error.code === "23514") {
      return failure("insufficient_points", "책갈피가 모자라. 조금만 더 모아볼까?", 402);
    }
    if (error.code === "23505") {
      return failure("already_owned", "이미 가지고 있어!", 409);
    }
    if (error.code === "P0002") {
      return failure("not_found", "그런 아이템을 찾을 수 없어.", 404);
    }
    console.error("[rewards] 아이템 구매 실패", error);
    return failure("server_error", SERVER_ERROR, 500);
  }

  // 산 뒤의 잔액과 목록을 다시 읽는다 — 화면이 한 번의 응답으로 갱신되게
  const [owned, points] = await Promise.all([
    ownedIds(supabase, userId),
    getPoints(supabase, userId),
  ]);
  if (!points.ok) return points;

  return { ok: true, data: { balance: points.data.balance, owned } };
}
