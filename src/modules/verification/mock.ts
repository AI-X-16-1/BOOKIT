/**
 * verification 모듈 목 데이터.
 *
 * ⚠️ 임시다. 실제 Route Handler 가 붙으면 이 파일은 지운다.
 * 리턴 타입은 전부 @/shared/types 의 API 계약 그대로다.
 *
 * 목업대로 보이게 하는 게 목적이지만, 채점만은 진짜로 판정한다.
 * 항상 통과시키면 재시도 화면을 볼 수 없고, 통과/실패 톤 차이도 확인이 안 된다.
 */

import type {
  AnswerResponse,
  GapType,
  QuestionResponse,
  ReviewGapView,
} from "@/shared/types";

import { delay } from "@/modules/review";

/** 빈틈 유형별 화면 라벨 (목업 2 L112, L117, L122). */
export const GAP_LABEL: Record<GapType, string> = {
  unsupported_claim: "근거 없이 단정",
  vague_statement: "뭉뚱그린 문장",
  feeling_only: "감상만 남음",
};

/** 빈틈 유형별 강조 색. 코랄 = 근거 없음, 옐로 = 나머지 (목업 2 L108). */
export const GAP_TONE: Record<GapType, "coral" | "yellow"> = {
  unsupported_claim: "coral",
  vague_statement: "yellow",
  feeling_only: "yellow",
};

/** AI #3 — 빈틈 하나에서 해석·추론형 질문을 만든다. */
const QUESTION_BY_GAP: Record<GapType, string> = {
  unsupported_claim:
    "구체적으로 어떤 장면에서 그 변화가 가장 잘 드러났다고 생각해?",
  vague_statement:
    "여러 사건 중에 너한테 제일 크게 남은 건 어떤 거야? 왜 그게 남았어?",
  feeling_only:
    "어느 인물의 어떤 행동에서 그런 마음이 들었어?",
};

/**
 * POST /api/reviews/:id/question, POST /api/reviews/:id/retry
 *
 * attempt 는 1부터. 재시도는 항상 **다른 빈틈**에서 새 질문을 만든다 (CLAUDE.md §6).
 * 실제 구현에서는 매번 LLM 을 새로 호출하므로 문구까지 달라진다.
 */
export async function requestQuestion(
  gaps: ReviewGapView[],
  attempt: number,
): Promise<QuestionResponse> {
  await delay(900);
  const gap = gaps[(attempt - 1) % gaps.length];
  return {
    verification_id: `mock-verification-${attempt}`,
    question: QUESTION_BY_GAP[gap.type],
    quote: gap.quote,
    // 실제로는 ANSWER_WINDOW_SEC 환경변수에서 온다 (기본 45, 허용 30-60).
    seconds: 45,
  };
}

/**
 * POST /api/verifications/:id/answer
 *
 * 진짜 채점은 LLM 이 한다. 여기서는 화면 확인용으로 아주 거친 대체 규칙을 쓴다:
 *   - 구체성: 길이와 장면을 가리키는 표현이 있는지
 *   - 정합성: 독후감에 나온 표현과 겹치는지
 * 이 규칙은 데모용이고, 실제 채점 기준이 아니다.
 */
export async function submitAnswer(
  answer: string,
  reviewBody: string,
): Promise<AnswerResponse> {
  await delay(1200);

  const text = answer.trim();
  const long = text.length >= 20;
  const pointsAtScene = /장면|때|부분|순간|말|행동|만나|다시/.test(text);

  // 독후감에 등장한 2글자 이상 낱말과 겹치는지 — 정합성의 거친 대체 지표
  const reviewWords = reviewBody
    .split(/[\s,.]+/)
    .filter((w) => w.length >= 2);
  const overlaps = reviewWords.some((w) => text.includes(w));

  const specificity = long && pointsAtScene ? "pass" : long ? "weak" : "fail";
  const logic = overlaps ? "pass" : "weak";
  const passed = specificity !== "fail" && logic === "pass";

  return {
    passed,
    scores: {
      logic_consistency: logic,
      specificity,
      style_consistency: "same",
    },
    feedback: passed
      ? "장면을 직접 근거로 들어서 구체적으로 설명했어요. 좋은 해석이에요!"
      : "조금만 더! 어느 장면이었는지 하나만 골라서 말해주면 훨씬 분명해질 거야.",
    points: passed ? 50 : 0,
  };
}

/** 점수 축을 화면 문구로 (목업 3 L79-80). */
export function axisLabel(axis: "pass" | "weak" | "fail"): string {
  return { pass: "높음", weak: "보통", fail: "낮음" }[axis];
}
