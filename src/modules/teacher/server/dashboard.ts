/**
 * 교사 대시보드 조회 — docs/spec.md §5 teacher.
 *
 * 소유: 김민경 (CLAUDE.md §3).
 *
 * 조회는 reviews·verifications 테이블 직접이 아니라 v_teacher_* 뷰를 경유한다.
 * 뷰에는 독후감 본문도 답변 원문도 없다 — RLS 는 컬럼을 가리지 못하므로
 * 그 차단이 뷰 정의문에 들어 있다 (0003 주석, CLAUDE.md §5).
 */

import type { BookitClient } from "@/shared/supabase";
import type {
  Class,
  ClassRankingRow,
  TeacherClassResponse,
  TeacherStudentRow,
} from "@/shared/types";

export type TeacherResult<T> =
  | { ok: true; data: T }
  | { ok: false; code: string; message: string; status: number };

const failure = (
  code: string,
  message: string,
  status: number,
): TeacherResult<never> => ({ ok: false, code, message, status });

const SERVER_ERROR = "잠깐 문제가 생겼어요. 다시 열어볼까요?";

/** 교사가 소유한 반. 온보딩에서 하나만 만들지만, 여러 개면 가장 먼저 만든 반이 기준이다 */
async function ownedClass(
  supabase: BookitClient,
  userId: string,
): Promise<TeacherResult<Class>> {
  const { data, error } = await supabase
    .from("classes")
    .select("*")
    .eq("teacher_id", userId)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("[teacher] 반 조회 실패", error);
    return failure("server_error", SERVER_ERROR, 500);
  }
  if (!data) {
    return failure("class_not_found", "아직 만든 반이 없어요.", 404);
  }
  return { ok: true, data };
}

/** GET /api/teacher/students — 이름·통과수·평균점수·연속·마지막 활동만 */
export async function getStudentRows(
  supabase: BookitClient,
  classId: string,
): Promise<TeacherResult<TeacherStudentRow[]>> {
  const { data, error } = await supabase
    .from("v_teacher_student_progress")
    .select("student_id, name, passed_count, avg_score, streak, last_active")
    .eq("class_id", classId)
    .order("passed_count", { ascending: false });

  if (error) {
    console.error("[teacher] 학생 진도 조회 실패", error);
    return failure("server_error", SERVER_ERROR, 500);
  }

  return { ok: true, data: data ?? [] };
}

/**
 * 동점은 같은 등수를 받고, 그 수만큼 다음 등수를 건너뛴다 (1, 2, 2, 4).
 * 순수 함수라 화면과 라우트가 같은 규칙을 쓴다.
 */
export function withRank(
  rows: Array<Omit<ClassRankingRow, "rank">>,
): ClassRankingRow[] {
  const sorted = [...rows].sort((a, b) => b.verified_count - a.verified_count);

  let lastCount: number | null = null;
  let lastRank = 0;

  return sorted.map((row, index) => {
    const rank = row.verified_count === lastCount ? lastRank : index + 1;
    lastCount = row.verified_count;
    lastRank = rank;
    return { ...row, rank };
  });
}

/** GET /api/teacher/ranking — 반 대 반. 개인 순위는 만들지 않는다 (docs/plan.md §4) */
export async function getClassRanking(
  supabase: BookitClient,
): Promise<TeacherResult<ClassRankingRow[]>> {
  const { data, error } = await supabase
    .from("v_class_ranking")
    .select("class_id, label, verified_count");

  if (error) {
    console.error("[teacher] 반 랭킹 조회 실패", error);
    return failure("server_error", SERVER_ERROR, 500);
  }

  return { ok: true, data: withRank(data ?? []) };
}

/** GET /api/teacher/class — 반 정보 + 요약 3칸 */
export async function getTeacherClass(
  supabase: BookitClient,
  userId: string,
): Promise<TeacherResult<TeacherClassResponse>> {
  const klass = await ownedClass(supabase, userId);
  if (!klass.ok) return klass;

  const rows = await getStudentRows(supabase, klass.data.id);
  if (!rows.ok) return rows;

  const completedCount = rows.data.reduce(
    (sum, row) => sum + row.passed_count,
    0,
  );
  // 아직 한 번도 통과하지 못한 학생은 평균에서 뺀다 — 0 점이 반 평균을 끌어내린다
  const scored = rows.data.filter((row) => row.passed_count > 0);
  const avgScore = scored.length
    ? Math.round(
        scored.reduce((sum, row) => sum + row.avg_score, 0) / scored.length,
      )
    : 0;

  return {
    ok: true,
    data: {
      class: klass.data,
      join_code: klass.data.join_code,
      stats: {
        student_count: rows.data.length,
        completed_count: completedCount,
        avg_score: avgScore,
      },
    },
  };
}

export { ownedClass };
