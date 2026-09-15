/**
 * verification/server/answer — 답변 채점. owner: 박재경
 *
 * docs/spec.md §5:
 *   POST /api/verifications/:id/answer  { answer } → { passed, scores, feedback, points }
 *
 * 채점 자체는 ai 모듈(AI #4)이 한다. 여기가 책임지는 것은 세 가지다.
 *   1. 이 시도가 정말 이 학생 것이고, 아직 채점 전인가
 *   2. 제한 시간 안에 도착했는가 — 판단은 서버의 asked_at 으로만 한다
 *   3. 결과와 책갈피를 한 트랜잭션으로 남기는가 (docs/spec.md §4)
 */
import "server-only";

import { grade } from "@/modules/ai";
import type { BookitClient } from "@/shared/supabase";
import { createAdminClient } from "@/shared/supabase/admin";
import type { AnswerResponse, GradeResult } from "@/shared/types";

import { loadContext } from "./context";
import { failure, type VerificationResult } from "./result";
import { isExpired, pointsPerPass } from "./window";

/**
 * 시간이 다 된 답.
 *
 * 요청을 튕기지 않고 실패한 시도로 기록한다. 오류로 돌려보내면 채점 안 된 시도가
 * 남아 재시도 흐름이 막히고, 화면에는 "잠깐 문제가 생겼어"만 뜬다.
 * 시간 초과는 사고가 아니라 결과 중 하나다 — 실패한 시도도 행을 남긴다 (CLAUDE.md §4).
 * 답안 본문은 그대로 저장하되 채점에는 쓰지 않는다.
 */
const TIMED_OUT: GradeResult = {
  logic_consistency: "fail",
  specificity: "fail",
  style_consistency: "same",
  passed: false,
  feedback: "시간이 다 됐어. 다음엔 떠오른 장면 하나만 딱 골라서 써볼까?",
};

export async function gradeAnswer(
  supabase: BookitClient,
  userId: string,
  verificationId: string,
  answer: string,
): Promise<VerificationResult<AnswerResponse>> {
  const { data: attempt, error } = await supabase
    .from("verifications")
    .select("id, review_id, student_id, gap_id, question, asked_at, answered_at")
    .eq("id", verificationId)
    .maybeSingle();

  if (error) throw error;
  // RLS 가 남의 행을 걸러내므로 "없음"과 "남의 것"이 같은 응답이 된다. 의도한 것이다
  if (!attempt || attempt.student_id !== userId) {
    return failure("verification_not_found", "그 질문을 찾을 수 없어.", 404);
  }
  if (attempt.answered_at !== null) {
    return failure("already_answered", "이 질문은 이미 채점했어.", 409);
  }

  const loaded = await loadContext(supabase, userId, attempt.review_id);
  if (!loaded.ok) return loaded;

  const { review, book, gaps, gradeLevel } = loaded.data;
  const gap = gaps.find((candidate) => candidate.id === attempt.gap_id);
  if (!gap) {
    // 빈틈이 다시 만들어져 이 시도의 근거가 사라진 경우. 채점할 기준이 없다
    return failure("gap_missing", "질문이 만료됐어. 새 질문을 받아볼까?", 409);
  }

  const result = isExpired(attempt.asked_at)
    ? TIMED_OUT
    : await grade(
        review.body,
        { quote: gap.quote, type: gap.gap_type, reason: gap.reason },
        attempt.question,
        answer,
        book,
        { gradeLevel },
      );

  const saved = await persist(attempt.id, userId, answer, result);
  if (!saved.ok) return saved;

  return {
    ok: true,
    data: {
      passed: result.passed,
      scores: {
        logic_consistency: result.logic_consistency,
        specificity: result.specificity,
        style_consistency: result.style_consistency,
      },
      feedback: result.feedback,
      points: saved.data,
    },
  };
}

/**
 * 결과 기록 · 책갈피 적립 · 독후감 상태 변경을 한 번에 맡긴다 (0008 마이그레이션).
 *
 * points_ledger 는 insert 정책이 없어 service role 로만 쓸 수 있고(0004),
 * supabase-js 로는 여러 문장을 한 트랜잭션에 묶을 수 없다. 그래서 RPC 다.
 * 함수 자체는 service_role 전용이라 학생이 브라우저에서 직접 부를 수 없다.
 * 소유권은 p_student_id 로 함수 안에서 한 번 더 확인한다.
 *
 * 돌려주는 값은 실제로 적립된 책갈피다 — 통과 50, 실패 0 (docs/spec.md §4).
 */
async function persist(
  verificationId: string,
  studentId: string,
  answer: string,
  result: GradeResult,
): Promise<VerificationResult<number>> {
  const points = result.passed ? pointsPerPass() : 0;

  const { data, error } = await createAdminClient().rpc("record_verification_result", {
    p_verification_id: verificationId,
    p_student_id: studentId,
    p_answer: answer,
    p_logic: result.logic_consistency,
    p_specificity: result.specificity,
    p_style: result.style_consistency,
    p_passed: result.passed,
    p_feedback: result.feedback,
    p_points: points,
  });

  if (error) {
    // 그 사이에 다른 요청이 먼저 채점했다는 뜻 (answered_at 이 이미 차 있다).
    // 버튼 두 번 누르기가 대표적이라, 서버 오류로 취급하지 않는다.
    if (error.code === "P0002") {
      return failure("already_answered", "이 질문은 이미 채점했어.", 409);
    }
    throw error;
  }

  return { ok: true, data: data?.points_awarded ?? points };
}
