/**
 * growth 표시 상수 — docs/spec.md §2, §5.
 *
 * 소유: 문민재 (CLAUDE.md §3).
 */

/** 책나무 — 완독 1권당 잎 하나. 단계에 따라 자란다 */
export const TREE_STAGES = ["🌱", "🌿", "🪴", "🌳"] as const;

/** 이 잎 수마다 책나무가 한 단계 자란다. 마지막 단계에서 멈춘다 */
export const LEAVES_PER_STAGE = 4;

/** 완독 3권 = 도장 1개 (docs/spec.md §2) */
export const STAMP_EVERY = 3;
