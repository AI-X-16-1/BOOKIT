/**
 * growth/server/growth — 스트릭·책나무·장르 도장판 조회. owner: 문민재
 *
 * docs/spec.md §5:
 *   GET /api/growth → { streak, tree_stage, leaves, stamps[] }
 *
 * 세 값 모두 저장된 요약이 아니라 매번 다시 센다 — sum(delta) 로 잔액을 계산하는
 * points_ledger 와 같은 이유다 (CLAUDE.md §4): 요약 컬럼을 따로 두면 갱신을 빼먹는
 * 경로가 생긴다.
 *
 * leaves = 완독(통과)한 독후감 수. tree_stage 는 LEAVES_PER_STAGE 마다 한 단계씩,
 * 마지막 단계에서 멈춘다.
 *
 * streaks·genre_stamps 는 이 파일이 쓰지 않는다 — points_ledger 에 verification_pass
 * 행이 쌓일 때 트리거(0010, 초안)가 올린다. 같은 날 여러 번 통과해도 스트릭은
 * 매번 늘고, 책의 태그 전부에 도장 진행도가 붙는다 (문민재 결정).
 */
import type { BookitClient } from "@/shared/supabase";
import type { GrowthResponse, GrowthStampView } from "@/shared/types";

import { LEAVES_PER_STAGE, STAMP_EVERY, TREE_STAGES } from "../schema";

export type GrowthResult<T> =
  | { ok: true; data: T }
  | { ok: false; code: string; message: string; status: number };

const failure = (
  code: string,
  message: string,
  status: number,
): GrowthResult<never> => ({ ok: false, code, message, status });

const SERVER_ERROR = "잠깐 문제가 생겼어. 다시 열어볼까?";

async function getStreak(
  supabase: BookitClient,
  userId: string,
): Promise<GrowthResult<GrowthResponse["streak"]>> {
  const { data, error } = await supabase
    .from("streaks")
    .select("current_days, longest_days")
    .eq("student_id", userId)
    .maybeSingle();

  if (error) {
    console.error("[growth] 스트릭 조회 실패", error);
    return failure("server_error", SERVER_ERROR, 500);
  }

  // 아직 한 번도 통과하지 못한 학생은 streaks 행이 없다 — 0으로 취급한다
  return { ok: true, data: data ?? { current_days: 0, longest_days: 0 } };
}

/** 완독 1권당 잎 하나. status='passed' 인 독후감 수로 센다 */
async function getLeaves(
  supabase: BookitClient,
  userId: string,
): Promise<GrowthResult<number>> {
  const { count, error } = await supabase
    .from("reviews")
    .select("id", { count: "exact", head: true })
    .eq("student_id", userId)
    .eq("status", "passed");

  if (error) {
    console.error("[growth] 완독 수 조회 실패", error);
    return failure("server_error", SERVER_ERROR, 500);
  }

  return { ok: true, data: count ?? 0 };
}

async function getStamps(
  supabase: BookitClient,
  userId: string,
): Promise<GrowthResult<GrowthStampView[]>> {
  const { data, error } = await supabase
    .from("genre_stamps")
    .select("genre, completed_count")
    .eq("student_id", userId)
    .order("completed_count", { ascending: false });

  if (error) {
    console.error("[growth] 장르 도장판 조회 실패", error);
    return failure("server_error", SERVER_ERROR, 500);
  }

  return {
    ok: true,
    data: (data ?? []).map((row) => ({
      ...row,
      stamps: Math.floor(row.completed_count / STAMP_EVERY),
    })),
  };
}

/** GET /api/growth */
export async function getGrowth(
  supabase: BookitClient,
  userId: string,
): Promise<GrowthResult<GrowthResponse>> {
  const [streak, leaves, stamps] = await Promise.all([
    getStreak(supabase, userId),
    getLeaves(supabase, userId),
    getStamps(supabase, userId),
  ]);
  if (!streak.ok) return streak;
  if (!leaves.ok) return leaves;
  if (!stamps.ok) return stamps;

  const treeStage = Math.min(
    Math.floor(leaves.data / LEAVES_PER_STAGE),
    TREE_STAGES.length - 1,
  );

  return {
    ok: true,
    data: {
      streak: streak.data,
      tree_stage: treeStage,
      leaves: leaves.data,
      stamps: stamps.data,
    },
  };
}
