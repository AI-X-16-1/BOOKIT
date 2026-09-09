/**
 * AI 모듈 내부 계약 — docs/spec.md §5 "ai (강민구)".
 * 라우트로 직접 노출되지 않는다. 프롬프트 원문은 docs/prompts.md.
 *
 * 모든 프롬프트 출력은 strict JSON 이다. 다만 이 타입은 "그렇게 오기를 기대하는 모양"일 뿐,
 * 보장이 아니다 — 파싱은 방어적으로 할 것 (CLAUDE.md §6).
 */

import type { GapType, GradeLevel, ScoreAxis, StyleAxis } from "./db";

/** AI #1 — 글쓰기 도우미. 쓰기 전에 길잡이 질문 하나. */
export interface WritingHelperResult {
  question: string;
}

/** AI #2 — 빈틈 분석. 최대 3개. */
export interface Gap {
  /** 학생이 실제로 쓴 문장 그대로 */
  quote: string;
  type: GapType;
  reason: string;
}

export interface AnalyzeGapsResult {
  gaps: Gap[];
}

/**
 * AI #3 — 질문 생성. 빈틈 하나를 받아 학생 문장을 인용하고 왜 그렇게 생각했는지 묻는다.
 * 해석·추론형만. 단순 사실 확인("인물 이름이 뭐였어")과 가정형("만약에")은 금지 (CLAUDE.md §6).
 */
export interface BuildQuestionResult {
  question: string;
}

/**
 * AI #4 — 채점. 맞고 틀림이 아니라 3개 축으로 본다.
 */
export interface GradeAxes {
  logic_consistency: ScoreAxis;
  specificity: ScoreAxis;
  style_consistency: StyleAxis;
}

export interface GradeResult extends GradeAxes {
  passed: boolean;
  /** 학생에게 그대로 보여주는 문구. 반말, 짧게, 혼내지 않기 (CLAUDE.md §9) */
  feedback: string;
}

/* ── 함수 시그니처 ─────────────────────────────────── */

export interface BookContext {
  title: string;
  author: string;
  tags: string[];
}

export type WritingHelper = (
  book: BookContext,
  grade: GradeLevel,
) => Promise<WritingHelperResult>;

export type AnalyzeGaps = (
  review: string,
  book: BookContext,
) => Promise<AnalyzeGapsResult>;

export type BuildQuestion = (
  gap: Gap,
  review: string,
) => Promise<BuildQuestionResult>;

export type Grade = (
  review: string,
  gap: Gap,
  question: string,
  answer: string,
) => Promise<GradeResult>;
