/**
 * ai/server/gaps — AI #2 빈틈 분석. owner: 강민구
 *
 * 서비스의 유일한 차별점이 여기서 시작한다. 독후감에서 근거가 빠진 문장을 찾아
 * 최대 3개 돌려준다. 이 결과가 곧 꼬리질문의 재료가 된다.
 */
import "server-only";

import type { AnalyzeGapsResult, BookContext, Gap } from "@/shared/types";

import { analyzeGapsSchema } from "../schema";
import { callJson } from "./llm";
import { GAP_ANALYSIS_SYSTEM, gapAnalysisUser, type PromptContext } from "./prompts";

/** 화면이 하이라이트 3곳을 그린다 (docs/spec.md, 목업 6번 화면). */
const MAX_GAPS = 3;

/**
 * 독후감에서 논리의 빈틈을 찾는다. 최대 3개, 없으면 빈 배열.
 *
 * 빈 배열은 오류가 아니라 "잘 쓴 독후감"이다. 호출부는 질문 없이 통과로
 * 보내야 한다 (docs/prompts.md §2). 억지로 빈틈을 만들지 않는다.
 */
export async function analyzeGaps(
  review: string,
  book: BookContext,
  context?: PromptContext,
): Promise<AnalyzeGapsResult> {
  const trimmed = review.trim();
  if (!trimmed) return { gaps: [] };

  const raw = await callJson({
    label: "gap-analysis",
    schema: analyzeGapsSchema,
    system: GAP_ANALYSIS_SYSTEM,
    user: gapAnalysisUser(trimmed, book, context),
    // 빈틈 3개 × (인용문 + 사유) + 사고 토큰. Gemini 는 사고 토큰이
    // maxOutputTokens 에 함께 잡히므로 넉넉히 잡는다 (providers.ts 참고).
    maxTokens: 4096,
  });

  return { gaps: normalizeGaps(raw.gaps, trimmed) };
}

/**
 * 모델이 준 빈틈을 화면에 그릴 수 있는 상태로 만든다.
 *
 * 핵심은 quote 다. 빈틈 분석 화면은 독후감 본문에서 quote 를 문자열로 찾아
 * 하이라이트하기 때문에, 한 글자라도 다르면 하이라이트가 뜨지 않는다.
 * 모델이 문장을 다듬어 오는 일이 실제로 있어서 여기서 원문으로 되돌린다.
 */
function normalizeGaps(gaps: Gap[], review: string): Gap[] {
  const seen = new Set<string>();
  const resolved: Gap[] = [];

  for (const gap of gaps) {
    const quote = resolveQuote(review, gap.quote);

    if (quote === null) {
      // 원문에 없는 문장은 버린다. 하이라이트가 안 되는 빈틈을 화면에
      // 올리는 것보다 2개만 보여주는 편이 낫다.
      console.warn(
        `[ai:gap-analysis] quote 가 독후감 원문에 없어 버린다: ${gap.quote}`,
      );
      continue;
    }

    if (seen.has(quote)) continue;
    seen.add(quote);

    resolved.push({ ...gap, quote });
    if (resolved.length >= MAX_GAPS) break;
  }

  return resolved;
}

/**
 * quote 를 독후감 원문에 있는 그대로의 문자열로 되돌린다. 없으면 null.
 *
 * 완전 일치가 아니면 공백을 무시하고 한 번 더 찾는다 — 모델이 줄바꿈을 공백으로
 * 바꾸거나 공백을 흘리는 경우가 잦은데, 그것 때문에 멀쩡한 빈틈을 버릴 이유는 없다.
 * 글자 자체가 다르면 버린다. 비슷한 문장을 억지로 갖다 붙이지 않는다.
 */
export function resolveQuote(review: string, quote: string): string | null {
  const candidate = quote?.trim();
  if (!candidate) return null;
  if (review.includes(candidate)) return candidate;

  const letters: string[] = [];
  const originalIndex: number[] = [];
  for (let i = 0; i < review.length; i += 1) {
    if (!/\s/.test(review[i])) {
      letters.push(review[i]);
      originalIndex.push(i);
    }
  }

  const target = candidate.replace(/\s+/g, "");
  if (!target) return null;

  const at = letters.join("").indexOf(target);
  if (at === -1) return null;

  return review.slice(originalIndex[at], originalIndex[at + target.length - 1] + 1);
}
