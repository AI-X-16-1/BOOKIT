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

/** 동그란 이모지 칸 배경 — 목업 10 M01 순서 (초록·코랄·노랑) */
const TILE_BG: Record<ExplorerRank, string> = {
  새싹: "bg-green-bg",
  탐험가: "bg-coral-bg-2",
  대장: "bg-yellow-bg",
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
    <div className="flex flex-col gap-3.5" role="radiogroup" aria-label="탐험가 등급">
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
              // 저학년 개편(목업 10 M01): 76px 동그란 이모지, Jua 25px, 3px 테두리
              "relative flex min-h-14 items-center gap-4 rounded-[26px] border-[3px] px-[18px] py-4 text-left transition-colors",
              selected
                ? "border-coral bg-coral-bg shadow-[0_12px_26px_rgba(255,107,74,.2)]"
                : "border-border bg-card",
              disabled && "opacity-60",
            )}
          >
            {selected && (
              <span
                aria-hidden
                className="absolute -top-4 right-3.5 rounded-full bg-coral px-3.5 py-1.5 font-display text-[16px] text-white animate-[bookit-wiggle_2.6s_ease-in-out_infinite]"
              >
                이거!
              </span>
            )}
            <span
              aria-hidden
              className={cn(
                "relative flex h-[76px] w-[76px] flex-none items-center justify-center rounded-full text-[38px]",
                TILE_BG[r.value],
                !selected && "animate-[bookit-bob-s_3.4s_ease-in-out_infinite]",
              )}
            >
              {selected && (
                <span className="absolute inset-0 rounded-full border-[3px] border-coral-light animate-[bookit-ring_2.2s_ease-out_infinite]" />
              )}
              {r.emoji}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block font-display text-[25px] text-ink">{r.value}</span>
              <span
                className={cn(
                  "mt-[2px] block text-[16px] font-medium",
                  selected ? "text-[#8A6A5C]" : "text-muted",
                )}
              >
                {r.blurb}
              </span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
