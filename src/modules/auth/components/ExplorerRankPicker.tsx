"use client";

import type { ExplorerRank } from "@/shared/types";
import { cn } from "@/shared/ui";

import { EXPLORER_RANKS } from "../explorer";

/**
 * 탐험가 등급 고르기 — 목업 7 #8 · 8 #9 (docs/mockups/7·8 보스전·성장 개편).
 *
 * 소유: 김민경 (CLAUDE.md §3).
 *
 * 세 값(새싹·탐험가·대장)이고 화면 톤에만 쓴다 — 목업의 4단계 학년대 카피는 #136 결정으로
 * 뺐다 (난이도는 학년이 정한다). 같은 카드를 다시 누르면 해제된다. 온보딩과 '나' 화면이 같이 쓴다.
 */

/** 카드 아이콘 칸 배경 — 목업의 노랑·코랄·초록 순서 */
const TILE_BG: Record<ExplorerRank, string> = {
  새싹: "bg-yellow-bg",
  탐험가: "bg-coral-bg-2",
  대장: "bg-green-bg",
};

export function ExplorerRankPicker({
  value,
  onChange,
  disabled = false,
}: {
  value: ExplorerRank | null;
  onChange: (next: ExplorerRank | null) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex flex-col gap-2.5" role="radiogroup" aria-label="탐험가 등급">
      {EXPLORER_RANKS.map((r) => {
        const selected = value === r.value;
        return (
          <button
            key={r.value}
            type="button"
            role="radio"
            aria-checked={selected}
            disabled={disabled}
            onClick={() => onChange(selected ? null : r.value)}
            className={cn(
              "flex min-h-12 items-center gap-3.5 rounded-card border p-[18px] text-left transition-colors",
              selected
                ? "border-2 border-coral bg-coral-bg"
                : "border-border bg-white",
              disabled && "opacity-60",
            )}
          >
            <span
              aria-hidden
              className={cn(
                "flex h-12 w-12 flex-none items-center justify-center rounded-[14px] text-[22px]",
                TILE_BG[r.value],
              )}
            >
              {r.emoji}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[17px] font-bold text-ink">{r.value} 탐험가</span>
              <span
                className={cn(
                  "mt-[3px] block text-[13px]",
                  selected ? "text-yellow-text-2" : "text-muted",
                )}
              >
                {r.blurb}
              </span>
            </span>
            {selected && (
              <span aria-hidden className="text-xl text-coral">
                ✓
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
