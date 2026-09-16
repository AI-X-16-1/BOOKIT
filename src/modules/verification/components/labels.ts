/**
 * 검증 화면 문구와 색. 목 데이터가 아니라 화면 계약이라 mock.ts 에서 옮겨 왔다.
 */

import type { GapType, ScoreAxis } from "@/shared/types";

/** 빈틈 유형별 화면 라벨 (목업 2 L112, L117, L122). */
export const GAP_LABEL: Record<GapType, string> = {
  unsupported_claim: "근거 없이 단정",
  vague_statement: "뭉뚱그린 문장",
  feeling_only: "감상만 남음",
  // 빈틈이 아니다 — 빈틈 0개일 때 고른 핵심 주장 (0013, issue #14)
  core_claim: "네 생각의 중심 문장",
};

export type GapTone = "coral" | "yellow" | "green";

/**
 * 빈틈 유형별 강조 색. 코랄 = 근거 없음, 옐로 = 나머지 (목업 2 L108).
 *
 * core_claim 만 초록이다. 지적이 아니라 "잘 썼다"는 신호라서 통과·무료 열람과
 * 같은 색을 쓴다 (docs/design-tokens.md "Color roles"). 색을 장식으로 고른 것이 아니다.
 */
export const GAP_TONE: Record<GapType, GapTone> = {
  unsupported_claim: "coral",
  vague_statement: "yellow",
  feeling_only: "yellow",
  core_claim: "green",
};

/** 본문에서 인용문을 강조할 때 (목업 2 L100-106). */
export const GAP_HIGHLIGHT: Record<GapTone, string> = {
  coral: "border-b-2 border-b-coral bg-coral-bg-2",
  yellow: "border-b-2 border-b-yellow bg-yellow-bg",
  green: "border-b-2 border-b-green bg-green-bg",
};

/** 빈틈 카드의 제목·본문 글자색. 초록은 전용 본문 토큰이 없어 제목 색을 같이 쓴다. */
export const GAP_CARD_TEXT: Record<GapTone, { title: string; body: string }> = {
  coral: { title: "text-coral-text", body: "text-coral-text-2" },
  yellow: { title: "text-yellow-text", body: "text-yellow-text-2" },
  green: { title: "text-green-text", body: "text-green-text" },
};

/** 점수 축을 화면 문구로 (목업 3 L79-80). */
export function axisLabel(axis: ScoreAxis): string {
  return { pass: "높음", weak: "보통", fail: "낮음" }[axis];
}
