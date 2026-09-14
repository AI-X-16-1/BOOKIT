/**
 * ai/server/grade — AI #4 채점. owner: 강민구
 *
 * 맞고 틀림이 아니라 독후감과의 정합성을 본다. 세 축이다.
 *   logic_consistency  독후감의 주장과 어긋나지 않는가
 *   specificity        장면이나 인물을 특정했는가
 *   style_consistency  독후감과 문체가 같은가  ← 대필 판별
 *
 * 점수는 verifications 행에 남고 통과 시에만 책갈피가 지급된다 (CLAUDE.md §4).
 */
import "server-only";

import type { BookContext, Gap, GradeAxes, GradeResult } from "@/shared/types";

import { gradeSchema } from "../schema";
import { callJson } from "./llm";
import {
  GRADING_SYSTEM,
  gradingUser,
  type PassThreshold,
  type PromptContext,
} from "./prompts";

/**
 * 답변을 채점한다.
 *
 * gap 은 프롬프트에 직접 쓰이지 않지만 계약(shared/types 의 Grade)에 들어 있어
 * 그대로 받는다. 채점은 독후감 전체와 답변을 대조하는 일이라 빈틈 하나에
 * 매이지 않는 편이 낫다.
 */
export async function grade(
  review: string,
  gap: Gap,
  question: string,
  answer: string,
  book?: BookContext,
  context?: PromptContext,
): Promise<GradeResult> {
  const trimmed = answer.trim();

  // 빈 답변은 모델에 보낼 필요가 없다. 시간이 다 됐거나 아무것도 안 쓴 경우다.
  if (!trimmed) {
    return {
      logic_consistency: "fail",
      specificity: "fail",
      style_consistency: "same",
      passed: false,
      feedback: "답을 못 썼네. 다시 한번 해보자.",
    };
  }

  const result = await callJson({
    label: "grading",
    schema: gradeSchema,
    system: GRADING_SYSTEM,
    user: gradingUser(review, question, trimmed, book, context),
    // 3축 판정 + 피드백 두 문장 + 사고 토큰 (providers.ts 참고).
    maxTokens: 2048,
  });

  // 모델이 준 passed 는 버린다. 통과 여부는 임계값으로 여기서 정한다.
  return { ...result, passed: isPass(result, readThreshold()) };
}

/**
 * 세 축 판정을 통과 여부로 바꾼다 (docs/prompts.md §4).
 *
 * - moderate: logic_consistency 가 fail 이 아니고 specificity 가 pass
 * - strict:   둘 다 pass
 * - 어느 쪽이든 style_consistency 가 shifted 면 통과시키지 않는다
 *
 * 문체가 급변했다는 건 학생이 쓴 답이 아닐 가능성이 크다는 뜻이다.
 * 여기가 대필 방지의 마지막 관문이라 임계값과 무관하게 막는다.
 */
export function isPass(axes: GradeAxes, threshold: PassThreshold): boolean {
  if (axes.style_consistency === "shifted") return false;

  return threshold === "strict"
    ? axes.logic_consistency === "pass" && axes.specificity === "pass"
    : axes.logic_consistency !== "fail" && axes.specificity === "pass";
}

/**
 * 시연 직전까지 조정할 수 있어야 한다 (plan-ko.md §5-3 "채점 기준 편차").
 * 잘못된 값이 들어오면 관대한 쪽으로 떨어뜨린다 — 심사위원이 데모하다
 * 튕기는 것이 가장 나쁜 결과다.
 */
export function readThreshold(): PassThreshold {
  const raw = process.env.PASS_THRESHOLD?.trim();
  if (raw === "strict") return "strict";
  if (raw && raw !== "moderate") {
    console.warn(`[ai:grading] PASS_THRESHOLD=${raw} 를 모르겠다. moderate 로 간다.`);
  }
  return "moderate";
}
