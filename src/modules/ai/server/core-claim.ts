/**
 * ai/server/core-claim — 빈틈이 0개인 독후감에서 되물을 문장 하나 고르기. owner: 강민구
 *
 * 왜 필요한가 (#14): 잘 쓴 독후감은 빈틈이 0개로 나온다 (채점 기준 실측 5건 중 4건).
 * 빈틈이 없다고 질문을 건너뛰면 "잘 대필한 독후감"이 검증을 통째로 피한다.
 * 그래서 빈틈이 없을 때도 학생의 핵심 판단 한 문장을 골라 질문의 재료로 쓴다.
 *
 * ⚠️ 호출부 연결은 #14 결정 대기 중이다. 고른 문장을 review_gaps 에 저장하려면
 *    gap_type enum 에 값이 하나 더 필요하다 (0003, 김민경 소관). 그래서 여기서는
 *    type 을 붙이지 않고 quote·reason 만 돌려준다 — shared/types 의 GapType 을 건드리지 않는다.
 */
import "server-only";

import type { BookContext } from "@/shared/types";

import { coreClaimSchema, type CoreClaim } from "../schema";
import { resolveQuote } from "./gaps";
import { callJson } from "./llm";
import { CORE_CLAIM_SYSTEM, coreClaimUser, type PromptContext } from "./prompts";

/**
 * 독후감에서 학생의 핵심 판단 한 문장을 고른다.
 *
 * 모델이 준 quote 가 독후감 원문에 없으면 null — 빈틈 분석과 같은 기준이다
 * (gaps.ts 의 resolveQuote). 하이라이트가 안 뜨는 문장으로 질문을 만들면
 * 학생은 자기가 쓰지 않은 문장에 대해 질문을 받는다.
 * null 이면 호출부가 지금처럼 초고로 돌려보내면 된다.
 */
export async function pickCoreClaim(
  review: string,
  book: BookContext,
  context?: PromptContext,
): Promise<CoreClaim | null> {
  const trimmed = review.trim();
  if (!trimmed) return null;

  const raw = await callJson({
    label: "core-claim",
    schema: coreClaimSchema,
    system: CORE_CLAIM_SYSTEM,
    user: coreClaimUser(trimmed, book, context),
    // 문장 하나 + 사유 하나지만 Gemini 는 사고 토큰이 같이 잡힌다. flash 에서 2048 은
    // 질문·채점이 실제로 잘렸다 (#36) — 같은 이유로 4096.
    maxTokens: 4096,
  });

  const quote = resolveQuote(trimmed, raw.quote);
  if (quote === null) {
    console.warn(`[ai:core-claim] quote 가 독후감 원문에 없어 버린다: ${raw.quote}`);
    return null;
  }

  return { quote, reason: raw.reason };
}
