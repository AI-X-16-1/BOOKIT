/**
 * 검증 화면 문구와 색. 목 데이터가 아니라 화면 계약이라 mock.ts 에서 옮겨 왔다.
 */

import type { GapType, ScoreAxis } from "@/shared/types";

/** 빈틈 유형별 화면 라벨 (목업 2 L112, L117, L122). */
export const GAP_LABEL: Record<GapType, string> = {
  unsupported_claim: "근거 없이 단정",
  vague_statement: "뭉뚱그린 문장",
  feeling_only: "감상만 남음",
  // 빈틈이 아니다 — 빈틈 0개일 때 고른 핵심 주장 (0013, issue #14). 화면 안내는 박재경이 맞춘다
  core_claim: "네 생각의 중심 문장",
};

/** 빈틈 유형별 강조 색. 코랄 = 근거 없음, 옐로 = 나머지 (목업 2 L108). */
export const GAP_TONE: Record<GapType, "coral" | "yellow"> = {
  unsupported_claim: "coral",
  vague_statement: "yellow",
  feeling_only: "yellow",
  core_claim: "yellow",
};

/** 점수 축을 화면 문구로 (목업 3 L79-80). */
export function axisLabel(axis: ScoreAxis): string {
  return { pass: "높음", weak: "보통", fail: "낮음" }[axis];
}
