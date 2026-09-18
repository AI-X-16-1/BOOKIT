/**
 * 검증 화면 문구와 색. 목 데이터가 아니라 화면 계약이라 mock.ts 에서 옮겨 왔다.
 */

import type { AnswerScores, GapType, ScoreAxis, StyleAxis } from "@/shared/types";

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

/* ── 보스전 프레이밍 (목업 7 #2·#3, docs/sprint-0918.md ①) ──────────── */

/**
 * 같은 세 축을 "보스를 때렸나" 로 읽는 라벨.
 *
 * 채점은 그대로다 — 점수·통과 기준·책갈피는 건드리지 않고 (sprint-0918 불변식)
 * 화면 프레임만 보스전이라 문구가 다르다. axisLabel 의 높음/보통/낮음은
 * 결과를 성적표처럼 읽히게 해서, 보스전 카드에서는 이 쪽을 쓴다.
 */
export const HIT_LABEL: Record<ScoreAxis, string> = {
  pass: "통과",
  weak: "보통",
  fail: "부족",
};

export const STYLE_HIT_LABEL: Record<StyleAxis, string> = {
  same: "동일",
  shifted: "달라짐",
};

/**
 * 보스 HP = 세 축 중 아직 못 때린 축의 수.
 *
 * 목업의 "3문 중 N문" 은 질문을 3개 던지는 것처럼 읽히지만, 검증은 늘 한 문항이다
 * (CLAUDE.md §6). 그래서 3 을 **질문 수가 아니라 채점 3축**으로 읽는다 —
 * 목업 실패 화면의 "1 / 3"(정합성 통과·구체성 부족·문체 동일)과 정확히 맞는다.
 * 파이프라인에 질문을 더하지 않고도 같은 화면이 나온다.
 */
export function bossHits(scores: AnswerScores): number {
  return (
    Number(scores.logic_consistency === "pass") +
    Number(scores.specificity === "pass") +
    Number(scores.style_consistency === "same")
  );
}

export const BOSS_AXES = 3;

/**
 * HP 줄 아래 문구.
 *
 * `passed` 와 HP 를 따로 본다 — PASS_THRESHOLD=moderate 에서는 정합성이 weak 이어도
 * 통과하므로 (ai/server/grade.ts 의 isPass) "통과했는데 HP 가 남은" 경우가 실제로 있다.
 * 그 경우를 "완전히 쓰러졌어요" 로 덮으면 화면이 점수와 다른 말을 한다.
 */
export function bossHpNote(hp: number, passed: boolean): string {
  if (hp === 0) return "완전히 쓰러졌어요";
  return passed ? "간신히 잡았어요" : "아직 버티고 있어요";
}
