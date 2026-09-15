/**
 * ranking/server/ranking — 반 대 반 랭킹(학생 쪽) + 챌린지. owner: 문민재
 *
 * docs/spec.md §5:
 *   GET /api/ranking/class  → { my_class, rows[] }
 *   GET /api/challenges     → { class_goal, season }
 *
 * 랭킹은 teacher 모듈이 이미 만든 v_class_ranking 뷰와 withRank 동점 처리를
 * 그대로 쓴다 — 교사 화면과 학생 화면이 같은 집계를 다른 틀에 담을 뿐,
 * 규칙이 갈리면 안 된다. 다른 오너의 모듈이지만 공개 배럴(@/modules/teacher)을
 * 통해서만 가져온다 (CLAUDE.md §2).
 *
 * 챌린지 진행값의 뜻이 종류마다 다르다:
 *   class_goal — 반 전체 목표라 같은 반 challenge_progress 를 다 더한다.
 *     RLS(challenge_progress_select_classmates, 0004)가 같은 반 학생 행만 보이게 한다.
 *   season — 학생 개인 목표라 본인 행 하나만 본다. class_id 가 null 이라
 *     반 합산은 뜻이 없다 (docs/spec.md §2).
 */
import type { BookitClient } from "@/shared/supabase";
import { withRank } from "@/modules/teacher";
import type {
  ChallengeView,
  ChallengesResponse,
  ClassRankingResponse,
} from "@/shared/types";

export type RankingResult<T> =
  | { ok: true; data: T }
  | { ok: false; code: string; message: string; status: number };

const failure = (
  code: string,
  message: string,
  status: number,
): RankingResult<never> => ({ ok: false, code, message, status });

const SERVER_ERROR = "잠깐 문제가 생겼어. 다시 열어볼까?";

/** 학생은 활성 학급을 최대 하나만 가진다 (docs/spec.md §2) */
async function myClassId(
  supabase: BookitClient,
  userId: string,
): Promise<RankingResult<string>> {
  const { data, error } = await supabase
    .from("class_members")
    .select("class_id")
    .eq("student_id", userId)
    .maybeSingle();

  if (error) {
    console.error("[ranking] 소속 반 조회 실패", error);
    return failure("server_error", SERVER_ERROR, 500);
  }
  if (!data) {
    return failure("no_class", "아직 반에 들어가지 않았어.", 404);
  }
  return { ok: true, data: data.class_id };
}

/** GET /api/ranking/class — 개인 순위는 노출하지 않는다. 반 단위만 (docs/plan.md §4) */
export async function getClassRanking(
  supabase: BookitClient,
  userId: string,
): Promise<RankingResult<ClassRankingResponse>> {
  const classId = await myClassId(supabase, userId);
  if (!classId.ok) return classId;

  const { data, error } = await supabase
    .from("v_class_ranking")
    .select("class_id, label, verified_count");

  if (error) {
    console.error("[ranking] 반 랭킹 조회 실패", error);
    return failure("server_error", SERVER_ERROR, 500);
  }

  const rows = withRank(data ?? []);
  const mine = rows.find((row) => row.class_id === classId.data);
  if (!mine) {
    return failure("class_not_found", "우리 반 순위를 찾지 못했어.", 404);
  }

  return { ok: true, data: { my_class: mine, rows } };
}

interface ChallengeRow {
  id: string;
  title: string;
  target: number;
  starts_on: string;
  ends_on: string;
}

/** 지금 진행 중인 챌린지 하나. 여러 개면 가장 최근에 시작한 것 */
async function currentChallenge(
  supabase: BookitClient,
  kind: "class_goal" | "season",
  classId: string | null,
): Promise<RankingResult<ChallengeRow | null>> {
  const today = new Date().toISOString().slice(0, 10);
  let query = supabase
    .from("challenges")
    .select("id, title, target, starts_on, ends_on")
    .eq("kind", kind)
    .lte("starts_on", today)
    .gte("ends_on", today)
    .order("starts_on", { ascending: false })
    .limit(1);

  query = classId === null ? query.is("class_id", null) : query.eq("class_id", classId);

  const { data, error } = await query.maybeSingle();
  if (error) {
    console.error(`[ranking] ${kind} 챌린지 조회 실패`, error);
    return failure("server_error", SERVER_ERROR, 500);
  }
  return { ok: true, data };
}

/** class_goal — 같은 반 전체의 진행값 합 */
async function classGoalValue(
  supabase: BookitClient,
  challengeId: string,
): Promise<RankingResult<number>> {
  const { data, error } = await supabase
    .from("challenge_progress")
    .select("value")
    .eq("challenge_id", challengeId);

  if (error) {
    console.error("[ranking] 반 목표 진행값 조회 실패", error);
    return failure("server_error", SERVER_ERROR, 500);
  }
  return { ok: true, data: (data ?? []).reduce((sum, row) => sum + row.value, 0) };
}

/** season — 학생 본인의 진행값만 */
async function ownValue(
  supabase: BookitClient,
  challengeId: string,
  userId: string,
): Promise<RankingResult<number>> {
  const { data, error } = await supabase
    .from("challenge_progress")
    .select("value")
    .eq("challenge_id", challengeId)
    .eq("student_id", userId)
    .maybeSingle();

  if (error) {
    console.error("[ranking] 시즌 챌린지 진행값 조회 실패", error);
    return failure("server_error", SERVER_ERROR, 500);
  }
  return { ok: true, data: data?.value ?? 0 };
}

function toView(row: ChallengeRow, value: number): ChallengeView {
  return { id: row.id, title: row.title, target: row.target, value, starts_on: row.starts_on, ends_on: row.ends_on };
}

/** GET /api/challenges */
export async function getChallenges(
  supabase: BookitClient,
  userId: string,
): Promise<RankingResult<ChallengesResponse>> {
  const classId = await myClassId(supabase, userId);
  if (!classId.ok) return classId;

  const goal = await currentChallenge(supabase, "class_goal", classId.data);
  if (!goal.ok) return goal;

  const season = await currentChallenge(supabase, "season", null);
  if (!season.ok) return season;

  let classGoal: ChallengeView | null = null;
  if (goal.data) {
    const value = await classGoalValue(supabase, goal.data.id);
    if (!value.ok) return value;
    classGoal = toView(goal.data, value.data);
  }

  let seasonView: ChallengeView | null = null;
  if (season.data) {
    const value = await ownValue(supabase, season.data.id, userId);
    if (!value.ok) return value;
    seasonView = toView(season.data, value.data);
  }

  return { ok: true, data: { class_goal: classGoal, season: seasonView } };
}
