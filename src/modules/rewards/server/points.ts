/**
 * rewards/server/points — 책갈피 원장 조회 + 교환. owner: 문민재
 *
 * docs/spec.md §5:
 *   GET  /api/points                    → { balance, ledger[] }
 *   POST /api/points/exchange { kind }  → { balance, voucher_url }
 *
 * 조회는 잔액 컬럼이 아니라 sum(delta) 다 — points_ledger 는 append-only (CLAUDE.md §4).
 * 적립은 verification 모듈이 record_verification_result RPC 로 이미 한다 (0008).
 * 여기서 새로 만드는 것은 차감(교환) 쪽 RPC 뿐이다 — 같은 이유로 서비스 롤 전용이다.
 */
import "server-only";

import type { BookitClient } from "@/shared/supabase";
import { createAdminClient } from "@/shared/supabase/admin";
import type { ExchangeKind, ExchangeResponse, PointsResponse } from "@/shared/types";

import { EXCHANGE_COST, EXCHANGE_REASON, VOUCHER_URL } from "../schema";

export type RewardsResult<T> =
  | { ok: true; data: T }
  | { ok: false; code: string; message: string; status: number };

const failure = (
  code: string,
  message: string,
  status: number,
): RewardsResult<never> => ({ ok: false, code, message, status });

const SERVER_ERROR = "잠깐 문제가 생겼어. 다시 해볼까?";

const balanceOf = (rows: Array<{ delta: number }>) =>
  rows.reduce((sum, row) => sum + row.delta, 0);

/** GET /api/points — RLS 가 본인 행만 걸러준다. 최신 순으로 돌려준다 */
export async function getPoints(
  supabase: BookitClient,
  userId: string,
): Promise<RewardsResult<PointsResponse>> {
  const { data, error } = await supabase
    .from("points_ledger")
    .select("id, delta, reason, created_at")
    .eq("student_id", userId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[rewards] 원장 조회 실패", error);
    return failure("server_error", SERVER_ERROR, 500);
  }

  return { ok: true, data: { balance: balanceOf(data ?? []), ledger: data ?? [] } };
}

/**
 * POST /api/points/exchange
 *
 * exchange_points RPC(0010, 초안) 가 잔액 확인과 차감을 한 트랜잭션으로 처리한다.
 * 학생 클라이언트가 points_ledger 에 직접 쓸 수 없어(0004) service role 로 부른다.
 * 함수 안에서 p_student_id 소유권을 다시 확인하므로 여기서는 인자만 넘긴다.
 */
export async function exchangePoints(
  userId: string,
  kind: ExchangeKind,
): Promise<RewardsResult<ExchangeResponse>> {
  const cost = EXCHANGE_COST[kind];
  const reason = EXCHANGE_REASON[kind];

  const { error } = await callExchange(createAdminClient(), {
    p_student_id: userId,
    p_reason: reason,
    p_cost: cost,
  });

  if (error) {
    // 0010 의 check_violation(23514) = 잔액 부족. 그 외는 예상 못 한 실패다.
    if (error.code === "23514") {
      return failure("insufficient_points", "책갈피가 모자라. 조금만 더 모아볼까?", 400);
    }
    console.error("[rewards] 교환 실패", error);
    return failure("server_error", SERVER_ERROR, 500);
  }

  const balance = await getPoints(createAdminClient(), userId);
  if (!balance.ok) return balance;

  return {
    ok: true,
    data: { balance: balance.data.balance, voucher_url: VOUCHER_URL },
  };
}

interface ExchangeArgs {
  p_student_id: string;
  p_reason: string;
  p_cost: number;
}

/**
 * ⚠️ 임시 캐스트.
 *
 * exchange_points 는 0010 초안이라 아직 shared/supabase/database.types.ts 의
 * Functions 에 없다. 그 파일은 김민경 소유라 이 세션에서 고치지 않는다 (CLAUDE.md §2).
 * 0010 가 머지되고 타입이 추가되면 이 함수를 지우고 supabase.rpc(...) 를 직접 부른다.
 * verification/server/answer.ts 의 recordResult 와 같은 이유, 같은 모양이다.
 */
function callExchange(
  admin: BookitClient,
  args: ExchangeArgs,
): PromiseLike<{
  data: { delta: number } | null;
  error: { code?: string; message: string } | null;
}> {
  const rpc = admin.rpc as unknown as (
    name: string,
    params: ExchangeArgs,
  ) => PromiseLike<{
    data: { delta: number } | null;
    error: { code?: string; message: string } | null;
  }>;

  return rpc("exchange_points", args);
}
