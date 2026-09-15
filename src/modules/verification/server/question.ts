/**
 * verification/server/question — 질문 발급과 재시도. owner: 박재경
 *
 * docs/spec.md §5:
 *   POST /api/reviews/:id/question  → { verification_id, question, quote, seconds }
 *   POST /api/reviews/:id/retry     → 같은 모양
 *
 * 두 라우트는 하나의 함수를 모드만 바꿔 부른다. 다른 점은 딱 두 가지다.
 *   - 재시도는 직전 시도가 채점을 마치고 실패했을 때만 열린다.
 *   - 재시도는 되도록 다른 빈틈을 골라, 이전 질문들을 피해 새로 만든다 (CLAUDE.md §6).
 *
 * 카운트다운의 기준점은 verifications.asked_at 이다. 이 함수가 응답을 돌려주는
 * 순간이 곧 시작 시각이라, 질문을 미리 만들어 두더라도 asked_at 은 여기서 찍는다.
 *
 * 읽기는 사용자 세션으로, verifications 와 reviews.status 쓰기는 admin 으로 한다 —
 * 0009 가 학생의 verifications 쓰기와 reviews.status 컬럼을 막았다 (issue #22).
 * 소유권은 loadContext 가 사용자 세션으로 이미 확인한 뒤다.
 */
import "server-only";

import { buildQuestion, LlmError } from "@/modules/ai";
import type { BookitClient } from "@/shared/supabase";
import { createAdminClient } from "@/shared/supabase/admin";
import type { QuestionResponse, ReviewGap } from "@/shared/types";

import { loadContext, type AttemptSummary, type VerificationContext } from "./context";
import { failure, type VerificationResult } from "./result";
import { answerWindowSeconds } from "./window";

export type QuestionMode = "first" | "retry";

export async function issueQuestion(
  supabase: BookitClient,
  userId: string,
  reviewId: string,
  mode: QuestionMode,
): Promise<VerificationResult<QuestionResponse>> {
  const loaded = await loadContext(supabase, userId, reviewId);
  if (!loaded.ok) return loaded;

  const context = loaded.data;
  const { attempts } = context;

  if (attempts.some((attempt) => attempt.passed)) {
    return failure("already_passed", "이 독후감은 이미 통과했어!", 409);
  }

  // 채점을 기다리는 시도가 남아 있으면 새로 만들지 않는다.
  // 화면을 새로 고치거나 버튼을 두 번 눌러도 시도 횟수가 늘지 않게 하려는 것이다.
  const open = attempts.find((attempt) => attempt.answered_at === null);
  if (open) {
    if (mode === "retry") {
      return failure("attempt_in_progress", "아직 답을 기다리는 중이야.", 409);
    }
    return restamp(supabase, context, open);
  }

  if (mode === "retry") {
    const last = attempts.at(-1);
    if (!last) {
      return failure("nothing_to_retry", "아직 답한 질문이 없어.", 409);
    }
  }

  return createAttempt(supabase, context, mode);
}

/**
 * 아직 답하지 않은 시도를 다시 내준다. 질문은 그대로 두고 asked_at 만 새로 찍는다.
 *
 * 같은 질문을 다시 주는 것이 부정행위로 이어지지 않는다 — 학생은 이 질문에 대해
 * 아직 아무 피드백도 받지 못했다. 새 질문을 강제하는 규칙(CLAUDE.md §6)은
 * 채점 결과를 본 뒤의 재시도에 대한 것이다.
 */
async function restamp(
  supabase: BookitClient,
  context: VerificationContext,
  attempt: AttemptSummary,
): Promise<VerificationResult<QuestionResponse>> {
  const askedAt = new Date().toISOString();
  const { error } = await createAdminClient()
    .from("verifications")
    .update({ asked_at: askedAt })
    .eq("id", attempt.id)
    .eq("student_id", context.review.student_id);

  if (error) throw error;

  const gap = context.gaps.find((candidate) => candidate.id === attempt.gap_id);
  return {
    ok: true,
    data: {
      verification_id: attempt.id,
      question: attempt.question,
      // 빈틈이 다시 만들어져 gap 이 사라진 경우까지 화면을 깨뜨리지 않는다
      quote: gap?.quote ?? "",
      seconds: answerWindowSeconds(),
    },
  };
}

async function createAttempt(
  supabase: BookitClient,
  context: VerificationContext,
  mode: QuestionMode,
): Promise<VerificationResult<QuestionResponse>> {
  const { review, book, gaps, attempts, gradeLevel } = context;
  const avoidQuestions = attempts.map((attempt) => attempt.question);
  const attemptNo = (attempts.at(-1)?.attempt_no ?? 0) + 1;

  const ordered = orderGaps(gaps, attempts);

  // 고른 빈틈에서 새 질문을 못 만들면 다음 빈틈으로 넘어간다.
  // ai 모듈은 이전 질문과 같은 질문이 두 번 나오면 LlmError 를 던진다 — 그때
  // 같은 빈틈을 붙들고 재시도해봐야 같은 결과다.
  let question: string | null = null;
  let gap: ReviewGap | null = null;
  let lastError: unknown = null;

  for (const candidate of ordered) {
    try {
      const built = await buildQuestion(
        { quote: candidate.quote, type: candidate.gap_type, reason: candidate.reason },
        review.body,
        book,
        { gradeLevel, avoidQuestions },
      );
      question = built.question;
      gap = candidate;
      break;
    } catch (cause) {
      lastError = cause;
      if (!(cause instanceof LlmError) || cause.kind !== "invalid_output") throw cause;
      console.warn(
        `[verification] 빈틈 ${candidate.ord} 에서 새 질문을 못 만들었다. 다음 빈틈으로 간다.`,
      );
    }
  }

  if (!question || !gap) {
    console.error("[verification] 모든 빈틈에서 질문 생성 실패", lastError);
    return failure(
      "question_unavailable",
      mode === "retry"
        ? "새 질문을 만들지 못했어. 독후감을 조금 더 써보고 다시 올래?"
        : "질문을 만들지 못했어. 잠깐 뒤에 다시 해볼까?",
      503,
    );
  }

  const admin = createAdminClient();
  const { data: created, error: insertError } = await admin
    .from("verifications")
    .insert({
      review_id: review.id,
      student_id: review.student_id,
      attempt_no: attemptNo,
      gap_id: gap.id,
      question,
    })
    .select("id")
    .single();

  if (insertError) {
    // unique (review_id, attempt_no). 버튼을 두 번 눌러 요청이 겹친 경우다 —
    // 먼저 도착한 쪽이 이미 같은 번호로 시도를 만들었다. 서버 오류로 취급하지 않는다.
    if (insertError.code === "23505") {
      return failure("attempt_in_progress", "질문을 만드는 중이야. 잠깐만!", 409);
    }
    throw insertError;
  }

  // 실패로 끝났던 독후감이 재시도로 다시 진행 중이 된다.
  const { error: statusError } = await admin
    .from("reviews")
    .update({ status: "questioning", updated_at: new Date().toISOString() })
    .eq("id", review.id);

  if (statusError) throw statusError;

  return {
    ok: true,
    data: {
      verification_id: created.id,
      question,
      quote: gap.quote,
      seconds: answerWindowSeconds(),
    },
  };
}

/**
 * 어느 빈틈부터 물어볼지 정한다.
 *
 * 덜 쓴 빈틈이 먼저다. 같은 횟수면 ord 가 작은 쪽 — AI #2 가 중요한 순서대로
 * 담아 준다. 첫 시도에서는 전부 0회라 자연스럽게 ord 1 이 된다.
 * 0003 마이그레이션의 "가능하면 다른 gap 에서 새 질문을 만든다"가 이 규칙이다.
 */
export function orderGaps(gaps: ReviewGap[], attempts: AttemptSummary[]): ReviewGap[] {
  const used = new Map<string, number>();
  for (const attempt of attempts) {
    used.set(attempt.gap_id, (used.get(attempt.gap_id) ?? 0) + 1);
  }

  return [...gaps].sort((a, b) => {
    const diff = (used.get(a.id) ?? 0) - (used.get(b.id) ?? 0);
    return diff !== 0 ? diff : a.ord - b.ord;
  });
}
