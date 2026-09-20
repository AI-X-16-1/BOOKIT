"use client";

import { useEffect, useState } from "react";
import type {
  CharactersResponse,
  ClassRankingResponse,
  GrowthResponse,
  MeResponse,
  PointsResponse,
} from "@/shared/types";
import { apiGet } from "@/shared/api/client";
import { GuardianShareCard } from "@/modules/guardian";
import { pickPartner } from "@/modules/reader";
import { REASON_LABEL } from "../schema";

/**
 * '나' 화면. 저학년 개편 — 목업 10 M09 (2026-09-20).
 *
 * 위에서부터: 파트너 얼굴 + 이름 + 학년·반·등급 + 칩 → 🔖 모은 책갈피(어두운 카드) →
 * 이번 주 읽기(요일 7칸) → (ItemShop 은 page.tsx 가 붙인다) → 보호자 링크 → 책갈피 기록.
 *
 * 숫자는 각 모듈 API 를 그대로 읽는다. 파트너 얼굴은 reader 의 pickPartner(가장 자란 친구).
 * 책갈피는 항상 "책갈피"다 (CLAUDE.md §9). 열람권 교환은 #58 로 뺐다.
 */

const DAY_LABEL = ["월", "화", "수", "목", "금", "토", "일"];

/** 이번 주(월~일) 7칸. 연속 기록이 오늘까지 이어졌다고 보고 뒤에서부터 칠한다 — 표시용이다 */
function weekCells(streak: number): Array<"fire" | "today" | "todo" | "off"> {
  const today = (new Date().getDay() + 6) % 7; // 월=0
  return DAY_LABEL.map((_, i) => {
    if (i > today) return "off";
    const daysAgo = today - i;
    if (daysAgo < streak) return "fire";
    return i === today ? "today" : "todo";
  });
}

export function MeScreen() {
  const [profile, setProfile] = useState<MeResponse | null>(null);
  const [points, setPoints] = useState<PointsResponse | null>(null);
  const [rank, setRank] = useState<ClassRankingResponse | null>(null);
  const [growth, setGrowth] = useState<GrowthResponse | null>(null);
  const [face, setFace] = useState<string>("🥚");
  const [grown, setGrown] = useState<number | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [showLedger, setShowLedger] = useState(false);

  useEffect(() => {
    apiGet<MeResponse>("/api/profile").then(setProfile).catch(() => {});
    apiGet<PointsResponse>("/api/points").then(setPoints).catch(() => {
      setNote("책갈피를 불러오지 못했어.");
    });
    apiGet<ClassRankingResponse>("/api/ranking/class").then(setRank).catch(() => {});
    apiGet<GrowthResponse>("/api/growth").then(setGrowth).catch(() => {});
    apiGet<CharactersResponse>("/api/characters")
      .then((r) => {
        setFace(pickPartner(r.characters)?.face ?? "🥚");
        setGrown(r.characters.filter((c) => c.stage === 2).length);
      })
      .catch(() => {});
  }, []);

  const passes = points?.ledger.filter((row) => row.reason === "verification_pass").length ?? null;
  const streak = growth?.streak.current_days ?? 0;
  const cells = weekCells(streak);

  return (
    <div className="flex flex-col gap-3.5">
      {/* 프로필 카드 */}
      <div className="flex items-center gap-4 rounded-[28px] border-[3px] border-coral-border bg-coral-bg p-[18px]">
        <span
          aria-hidden
          className="flex h-24 w-24 flex-none items-center justify-center rounded-full text-[50px] animate-[bookit-bob_4.2s_ease-in-out_infinite]"
          style={{ background: "radial-gradient(circle at 50% 35%, #FFE3D9, #FFCDBD)" }}
        >
          {face}
        </span>
        <div className="min-w-0">
          <h1 className="truncate text-[28px] text-ink">{profile ? profile.display_name : "—"}</h1>
          <div className="mt-0.5 text-[16px] font-medium text-coral-muted">
            {profile
              ? [
                  profile.grade_level ? `${profile.grade_level}학년` : null,
                  profile.class_label,
                  profile.explorer_rank ? `${profile.explorer_rank} ${profile.explorer_rank === "새싹" ? "🌱" : profile.explorer_rank === "탐험가" ? "🧭" : "👑"}` : null,
                ]
                  .filter(Boolean)
                  .join(" · ")
              : "—"}
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <span className="rounded-full border-2 border-coral-border bg-card px-3 py-1 font-display text-[15px] text-coral-ink">
              친구 {grown ?? "—"}
            </span>
            <span className="rounded-full border-2 border-coral-border bg-card px-3 py-1 font-display text-[15px] text-coral-ink">
              독후감 {passes ?? "—"}
            </span>
            {rank && (
              <span className="rounded-full border-2 border-coral-border bg-card px-3 py-1 font-display text-[15px] text-coral-ink">
                우리 반 {rank.my_class.rank}위
              </span>
            )}
          </div>
        </div>
      </div>

      {/* 모은 책갈피 */}
      <div className="flex items-center gap-3.5 rounded-[26px] bg-ink px-[22px] py-[18px] text-on-dark">
        <span aria-hidden className="text-[30px]">🔖</span>
        <span className="font-display text-[40px] leading-none text-yellow">
          {points ? points.balance.toLocaleString() : "—"}
        </span>
        <span className="ml-auto text-[16px] font-medium text-on-dark-2">모은 책갈피</span>
      </div>

      {/* 이번 주 읽기 */}
      <div className="rounded-card border-[3px] border-border bg-card px-[18px] py-4">
        <div className="mb-3 flex items-center gap-2.5">
          <h2 className="text-[20px] text-ink">이번 주 읽기</h2>
          <span className="rounded-full bg-yellow-bg px-3 py-1 font-display text-[16px] text-yellow-text">
            🔥 {streak}일째
          </span>
        </div>
        <div className="flex gap-1.5">
          {cells.map((cell, i) => (
            <div key={i} className="flex flex-1 flex-col items-center gap-1.5">
              <span
                className={
                  cell === "fire"
                    ? "flex h-[46px] w-full items-center justify-center rounded-[14px] bg-yellow text-[20px]"
                    : cell === "today"
                      ? "flex h-[46px] w-full items-center justify-center rounded-[14px] border-[3px] border-dashed border-[#FFB79F] bg-coral-bg font-display text-[14px] text-coral"
                      : "h-[46px] w-full rounded-[14px] bg-sunken"
                }
              >
                {cell === "fire" ? "🔥" : cell === "today" ? "오늘" : ""}
              </span>
              <span className="text-[14px] font-medium text-muted">{DAY_LABEL[i]}</span>
            </div>
          ))}
        </div>
        {note && <p className="mt-3 text-center text-[14px] text-coral-text">{note}</p>}
      </div>

      {/* #81: 발급 API는 있었는데 부르는 화면이 없었다 */}
      <GuardianShareCard />

      {/* 원장 — append-only 라 차감도 한 줄로 쌓인다. 길어서 접어 둔다 */}
      <div className="rounded-card border-[3px] border-border bg-card px-[18px] py-4">
        <button
          type="button"
          onClick={() => setShowLedger((v) => !v)}
          aria-expanded={showLedger}
          className="flex min-h-11 w-full items-center justify-between"
        >
          <h2 className="text-[20px] text-ink">책갈피 기록</h2>
          <span className="text-[15px] font-medium text-muted">{showLedger ? "접기 ▴" : "펼치기 ▾"}</span>
        </button>
        {showLedger && (
          <div className="mt-1">
            {points?.ledger.map((row) => (
              <div key={row.id} className="flex items-center gap-3 border-b border-border-soft py-2.5 text-[16px] last:border-b-0">
                <span className="flex-1 truncate text-ink">{REASON_LABEL[row.reason] ?? row.reason}</span>
                <span className={`font-display text-[18px] ${row.delta > 0 ? "text-green" : "text-coral"}`}>
                  {row.delta > 0 ? "+" : ""}
                  {row.delta}
                </span>
              </div>
            ))}
            {points && points.ledger.length === 0 && (
              <p className="py-3 text-center text-[15px] text-muted">아직 기록이 없어</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
