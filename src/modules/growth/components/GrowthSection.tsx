"use client";

import { useEffect, useState } from "react";
import type { GrowthResponse } from "@/shared/types";
import { Card, Chip } from "@/shared/ui";
import {
  BADGES,
  LEVEL,
  READING_PROFILE,
  TREE_STAGES,
  getGrowth,
} from "../mock";

/**
 * 성장 — 책나무 · 장르 도장판 · 레벨/뱃지 · 독서성향 리포트.
 * 목업 5 #3 (L198-243) 의 리포트를 모바일 폭에 맞춰 재구성했다.
 *
 * 시간이 부족하면 이 순서로 잘라낸다:
 * 독서성향 리포트 → 레벨/뱃지 → 책나무·도장판 (CLAUDE.md §11).
 *
 * ⚠️ 목 데이터로 도는 화면이다.
 */
const TONE_BAR = {
  coral: "bg-coral",
  yellow: "bg-yellow",
  green: "bg-green-light",
} as const;

export function GrowthSection() {
  const [g, setG] = useState<GrowthResponse | null>(null);

  useEffect(() => {
    getGrowth().then(setG);
  }, []);

  return (
    <div className="flex flex-col gap-4">
      {/* 책나무 — 완독 1권당 잎 하나 */}
      <Card>
        <div className="flex items-baseline justify-between">
          <span className="text-[15px] font-bold text-ink">내 책나무</span>
          <span className="text-[13px] text-muted">
            잎 {g?.leaves ?? 0}장
          </span>
        </div>
        <div className="mt-3 flex items-end gap-3">
          <span className="text-[44px] leading-none">
            {TREE_STAGES[Math.min(g?.tree_stage ?? 0, TREE_STAGES.length - 1)]}
          </span>
          <div className="flex-1">
            <div className="flex flex-wrap gap-1">
              {Array.from({ length: g?.leaves ?? 0 }).map((_, i) => (
                <span key={i} className="text-sm">
                  🍃
                </span>
              ))}
            </div>
            <p className="mt-2 text-[13px] text-muted">
              한 권 완독할 때마다 잎이 한 장 자라
            </p>
          </div>
        </div>
      </Card>

      {/* 장르 도장판 — 3권당 도장 1개 */}
      <Card>
        <div className="text-[15px] font-bold text-ink">장르 도장판</div>
        <p className="mt-1 text-[13px] text-muted">같은 장르 3권이면 도장 하나</p>
        <div className="mt-3 flex flex-col gap-2.5">
          {g?.stamps.map((s) => (
            <div key={s.genre} className="flex items-center gap-3">
              <span className="w-20 flex-none text-sm text-ink-soft">
                {s.genre}
              </span>
              <div className="flex flex-1 gap-1">
                {Array.from({ length: 3 }).map((_, i) => (
                  <span
                    key={i}
                    className={`flex h-7 w-7 items-center justify-center rounded-full text-xs ${
                      i < s.completed_count % 3 || s.stamps > 0
                        ? "bg-yellow text-stamp-text"
                        : "bg-sunken text-faint"
                    }`}
                  >
                    ★
                  </span>
                ))}
              </div>
              <span className="flex-none text-[13px] text-muted">
                {s.completed_count}권
              </span>
              {s.stamps > 0 && <Chip tone="yellow">도장 {s.stamps}</Chip>}
            </div>
          ))}
        </div>
      </Card>

      {/* 레벨 */}
      <div className="rounded-card bg-yellow-bg p-[22px]">
        <div className="flex items-center justify-between gap-3">
          <span className="text-base font-bold text-ink">
            Lv.{LEVEL.level} {LEVEL.title}
          </span>
          <span className="flex-none text-[13px] text-yellow-text-2">
            다음 레벨까지 {LEVEL.toNext}
          </span>
        </div>
        <div className="mt-3 h-2.5 rounded-full bg-yellow/40">
          <div
            className="h-2.5 rounded-full bg-coral-deep"
            style={{ width: `${LEVEL.progress * 100}%` }}
          />
        </div>
      </div>

      {/* 뱃지 */}
      <Card>
        <div className="text-[13px] text-muted">모은 뱃지</div>
        <div className="mt-3.5 grid grid-cols-4 gap-3">
          {BADGES.map((b) => (
            <div key={b.label} className="text-center">
              <div
                className={`flex aspect-square w-full items-center justify-center rounded-[14px] text-[22px] ${
                  b.earned ? "bg-yellow-bg" : "bg-sunken opacity-35"
                }`}
              >
                {b.icon}
              </div>
              <div
                className={`mt-[7px] text-[11px] ${b.earned ? "text-coral-text-2" : "text-faint"}`}
              >
                {b.label}
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* 독서성향 리포트 */}
      <div className="rounded-card bg-panel p-[22px]">
        <div className="text-xs text-on-dark-2">한 줄 요약</div>
        <div className="mt-2 text-[23px] leading-[1.45] font-bold text-on-dark">
          {READING_PROFILE.summary[0]}
          <br />
          {READING_PROFILE.summary[1]}
        </div>
        <div className="mt-4">
          {READING_PROFILE.axes.map((a) => (
            <div key={a.label} className="flex items-center gap-2.5 py-1.5">
              <span className="w-16 flex-none text-xs text-on-dark-2">
                {a.label}
              </span>
              <span className="h-2 flex-1 rounded-full bg-panel-line">
                <span
                  className={`block h-2 rounded-full ${TONE_BAR[a.tone]}`}
                  style={{ width: `${a.value * 100}%` }}
                />
              </span>
            </div>
          ))}
        </div>
        <p className="mt-3 text-xs text-on-dark-2">
          독후감 {READING_PROFILE.reviewCount}편을 모아 분석했어요 · 매월 1일 갱신
        </p>
      </div>

      {/* 좋아하는 주제어 — 코랄 투명도 단계로 표현 */}
      <Card>
        <div className="text-[13px] text-muted">좋아하는 주제어</div>
        <div className="mt-3.5 flex flex-col gap-2">
          {READING_PROFILE.topics.map((t, i) => (
            <div key={t.label} className="flex items-center gap-3">
              <span className="w-[74px] flex-none text-sm text-ink-soft">
                {t.label}
              </span>
              <span className="h-3 flex-1 rounded-full bg-border-soft">
                <span
                  className={`block h-3 rounded-full ${["bg-coral", "bg-coral/70", "bg-coral/45", "bg-coral/25"][i] ?? "bg-coral/25"}`}
                  style={{ width: `${t.value * 100}%` }}
                />
              </span>
            </div>
          ))}
        </div>
        <p className="mt-3 text-xs text-faint">데모에서는 시드 데이터로 채워요</p>
      </Card>
    </div>
  );
}
