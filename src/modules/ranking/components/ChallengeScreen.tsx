"use client";

import { useEffect, useState } from "react";
import type { ChallengesResponse, ClassRankingResponse } from "@/shared/types";
import { apiGet } from "@/shared/api/client";

/**
 * 반 대항전. 저학년 개편 — 목업 10 M10 (2026-09-20).
 *
 * "우리 반 대항전" → 🏆 우리 반 순위 카드(진행바) → 반 순위 🥇🥈🥉 → 반 목표 챌린지.
 * 개인 순위는 없다 — 등수는 반끼리만 (CLAUDE.md §4·§5). AI 확인을 통과한 완독만 센다.
 */

const MEDAL = ["🥇", "🥈", "🥉"];

export function ChallengeScreen() {
  const [ch, setCh] = useState<ChallengesResponse | null>(null);
  const [rank, setRank] = useState<ClassRankingResponse | null>(null);

  useEffect(() => {
    apiGet<ChallengesResponse>("/api/challenges").then(setCh).catch(() => {});
    apiGet<ClassRankingResponse>("/api/ranking/class").then(setRank).catch(() => {});
  }, []);

  const goal = ch?.class_goal;
  const goalPct = goal ? Math.round((goal.value / goal.target) * 100) : 0;

  const mine = rank?.my_class;
  const top = rank?.rows[0];
  const gap = mine && top && top.class_id !== mine.class_id ? top.verified_count - mine.verified_count + 1 : 0;
  const barPct = mine && top && top.verified_count > 0 ? Math.round((mine.verified_count / top.verified_count) * 100) : 0;

  return (
    <div className="flex flex-col gap-3.5">
      <div className="flex items-center gap-2.5">
        <h1 className="text-[28px] text-ink">우리 반 대항전</h1>
        {ch?.season && (
          <span className="rounded-full bg-blue-bg px-3 py-1.5 font-display text-[15px] text-blue-text">
            🍂 {ch.season.title}
          </span>
        )}
      </div>

      {/* 우리 반 */}
      <div className="flex flex-col gap-2.5 rounded-[26px] border-[3px] border-coral-border bg-coral-bg p-[18px]">
        <div className="flex items-center gap-3.5">
          <span aria-hidden className="flex h-[72px] w-[72px] flex-none items-center justify-center rounded-[20px] bg-yellow text-[36px] animate-[bookit-wiggle_3.2s_ease-in-out_infinite]">
            🏆
          </span>
          <div className="min-w-0 flex-1">
            <div className="font-display text-[24px] text-ink">
              {mine ? (mine.rank === 1 ? "우리 반이 1등이야!" : `우리 반이 ${mine.rank}등이야!`) : "불러오는 중…"}
            </div>
            <div className="text-[16px] font-medium text-coral-muted">
              {mine ? (gap > 0 ? `독후감 ${gap}개만 더 통과하면 1등` : "지금처럼만 하면 돼!") : ""}
            </div>
          </div>
          <span className="flex-none font-display text-[32px] text-coral-ink">{mine?.verified_count ?? "—"}</span>
        </div>
        <div className="h-[18px] w-full overflow-hidden rounded-full bg-coral-bg-2">
          <div
            className="h-full rounded-full transition-[width] duration-700"
            style={{ width: `${Math.max(barPct, 4)}%`, background: "linear-gradient(90deg, #FF8F75, #FF6B4A)" }}
          />
        </div>
      </div>

      {/* 반 순위 */}
      <div className="flex flex-col gap-2.5 rounded-card border-[3px] border-border bg-card px-[18px] py-4">
        <h2 className="text-[20px] text-ink">반 순위</h2>
        {rank?.rows.map((row, i) => {
          const isMine = row.class_id === rank.my_class.class_id;
          return (
            <div
              key={row.class_id}
              className={
                isMine
                  ? "flex items-center gap-3 rounded-[16px] border-[3px] border-coral bg-coral-bg-2 px-3.5 py-[11px]"
                  : i === 0
                    ? "flex items-center gap-3 rounded-[16px] bg-yellow-bg px-3.5 py-[11px]"
                    : "flex items-center gap-3 rounded-[16px] bg-sunken px-3.5 py-[11px]"
              }
            >
              <span aria-hidden className="w-7 flex-none text-center text-[22px]">
                {MEDAL[i] ?? <span className="font-display text-[18px] text-faint">{row.rank}</span>}
              </span>
              <span className="flex-1 truncate font-display text-[20px] text-ink">
                {row.label}
                {isMine && <span className="ml-1.5 font-display text-[14px] text-coral-ink">우리 반</span>}
              </span>
              <span className={`flex-none font-display text-[20px] ${isMine ? "text-coral-ink" : i === 0 ? "text-yellow-text" : "text-ink-warm"}`}>
                {row.verified_count}
              </span>
            </div>
          );
        })}
        <p className="mt-1 rounded-[16px] bg-sunken px-3.5 py-3 text-[15px] leading-[1.6] font-medium text-muted">
          독후감을 통과한 책만 세. 등수는 반끼리만 보여
        </p>
      </div>

      {/* 반 목표 */}
      {goal && (
        <div className="rounded-card border-[3px] border-border bg-card px-[18px] py-4">
          <div className="flex items-baseline justify-between gap-3">
            <h2 className="text-[20px] text-ink">{goal.title}</h2>
            <span className="flex-none font-display text-[18px] text-yellow-text">
              {goal.value} / {goal.target}권
            </span>
          </div>
          <div className="mt-3 h-3.5 overflow-hidden rounded-full bg-yellow-bg">
            <div className="h-full rounded-full bg-yellow transition-[width] duration-700" style={{ width: `${goalPct}%` }} />
          </div>
          <p className="mt-2.5 text-[15px] font-medium text-muted">🎉 다 채우면 우리 반 파티!</p>
        </div>
      )}
    </div>
  );
}
