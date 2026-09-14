"use client";

import { useEffect, useState } from "react";
import type { ChallengesResponse, ClassRankingResponse } from "@/shared/types";
import { apiGet } from "@/shared/api/client";
import { Card, Chip } from "@/shared/ui";

/** 챌린지 + 반 랭킹. 목업 4 #3 (L263-300). */
export function ChallengeScreen() {
  const [ch, setCh] = useState<ChallengesResponse | null>(null);
  const [rank, setRank] = useState<ClassRankingResponse | null>(null);

  useEffect(() => {
    apiGet<ChallengesResponse>("/api/challenges").then(setCh).catch(() => {});
    apiGet<ClassRankingResponse>("/api/ranking/class").then(setRank).catch(() => {});
  }, []);

  const goal = ch?.class_goal;
  const pct = goal ? Math.round((goal.value / goal.target) * 100) : 0;

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-[22px] font-bold text-ink">챌린지</h1>
        <p className="mt-1.5 text-[13px] text-muted">
          혼자보다 같이, 지금이 아니면 못 얻는 배지도 있어요
        </p>
      </div>

      {/* 반 목표 */}
      <div className="rounded-[18px] bg-panel p-5">
        {goal ? (
          <>
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-base font-bold text-on-dark">
                {goal.title}
              </span>
              <span className="flex-none text-sm font-bold text-yellow">
                {goal.value} / {goal.target}권
              </span>
            </div>
            <div className="mt-3 h-3 rounded-full bg-panel-line">
              <div
                className="h-3 rounded-full bg-coral transition-[width] duration-700"
                style={{ width: `${pct}%` }}
              />
            </div>
            <p className="mt-3 text-xs text-on-dark-2">+21명 참여 중</p>
            <p className="mt-3 text-[13px] text-yellow">
              🎉 목표 달성하면 학급 파티!
            </p>
          </>
        ) : (
          <p className="text-sm text-on-dark-2">불러오는 중…</p>
        )}
      </div>

      {/* 시즌 */}
      {ch?.season && (
        <Card className="rounded-[18px] p-5">
          <div className="flex items-center justify-between gap-3">
            <span className="text-base font-bold text-ink">
              {ch.season.title}
            </span>
            <Chip tone="yellow">10.1~10.31</Chip>
          </div>
          <div className="mt-3.5 flex items-center gap-2">
            {Array.from({ length: ch.season.target }).map((_, i) => (
              <div
                key={i}
                className={`h-2 flex-1 rounded-full ${i < ch.season!.value ? "bg-green" : "bg-sunken"}`}
              />
            ))}
          </div>
          <p className="mt-2.5 text-[13px] text-muted">
            {ch.season.value} / {ch.season.target}권 완독
          </p>
        </Card>
      )}

      {/* 반 랭킹 — 개인 순위는 없다 */}
      <div>
        <h2 className="text-[17px] font-bold text-ink">반 대 반 랭킹</h2>
        <p className="mt-1 text-[13px] text-muted">
          AI 확인을 통과한 완독만 세요
        </p>
        <div className="mt-3 flex flex-col gap-2">
          {rank?.rows.map((row) => {
            const mine = row.class_id === rank.my_class.class_id;
            return (
              <Card
                key={row.class_id}
                className={`flex items-center gap-3 ${mine ? "border-coral" : ""}`}
              >
                <span
                  className={`w-6 flex-none text-center text-base font-bold ${mine ? "text-coral" : "text-faint"}`}
                >
                  {row.rank}
                </span>
                <span className="flex-1 truncate text-[15px] font-bold text-ink">
                  {row.label}
                </span>
                {mine && <Chip tone="coral">우리 반</Chip>}
                <span className="flex-none text-sm text-muted">
                  {row.verified_count}권
                </span>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
}
