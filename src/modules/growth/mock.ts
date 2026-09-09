/**
 * growth 모듈 목 데이터. ⚠️ 임시 — 실제 Route Handler 가 붙으면 지운다.
 */
import type { GrowthResponse } from "@/shared/types";
import { delay } from "@/modules/review";

/** GET /api/growth — 완독 3권당 도장 1개 (docs/spec.md §2). */
export async function getGrowth(): Promise<GrowthResponse> {
  await delay(250);
  const stamps = [
    { genre: "성장", completed_count: 6 },
    { genre: "한국소설", completed_count: 4 },
    { genre: "고전", completed_count: 3 },
    { genre: "외국소설", completed_count: 2 },
    { genre: "동화", completed_count: 1 },
  ];
  return {
    streak: { current_days: 7, longest_days: 12 },
    tree_stage: 3,
    leaves: 12,
    stamps: stamps.map((s) => ({
      ...s,
      stamps: Math.floor(s.completed_count / 3),
    })),
  };
}

/** 레벨. 목업 5 L226-229. */
export const LEVEL = {
  level: 4,
  title: "꾸준한 독서가",
  toNext: 260,
  progress: 0.72,
};

/** 뱃지. 목업 5 L235-240. */
export const BADGES = [
  { icon: "🔖", label: "첫 책갈피", earned: true },
  { icon: "🔥", label: "7일 연속", earned: true },
  { icon: "📖", label: "10권 완독", earned: true },
  { icon: "🏆", label: "반 1위", earned: false },
];

/**
 * 독서성향 리포트. 목업 5 #3 (L198-232).
 * 실제로는 누적된 독후감을 AI 가 요약한다. 데모는 시드 데이터로 채운다.
 */
export const READING_PROFILE = {
  summary: ["판타지를 좋아하고,", "인물 심리 해석에 강해요"],
  reviewCount: 12,
  axes: [
    { label: "해석력", value: 0.88, tone: "coral" as const },
    { label: "구체성", value: 0.64, tone: "yellow" as const },
    { label: "어휘", value: 0.75, tone: "green" as const },
  ],
  topics: [
    { label: "판타지", value: 0.86 },
    { label: "인물 심리", value: 0.72 },
    { label: "성장", value: 0.58 },
    { label: "우정", value: 0.4 },
  ],
};

/** 책나무 — 완독 1권당 잎 하나. 단계에 따라 자란다. */
export const TREE_STAGES = ["🌱", "🌿", "🪴", "🌳"];
