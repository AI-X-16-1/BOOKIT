"use client";

import { useEffect, useState } from "react";
import type { GrowthResponse } from "@/shared/types";
import { apiGet } from "@/shared/api/client";
import { Card, Chip } from "@/shared/ui";
import { TREE_STAGES } from "../schema";

/**
 * 성장 — 책나무 · 장르 도장판 · 레벨/뱃지 · 독서성향 리포트.
 * 목업 5 #3 (L198-243) 의 리포트를 모바일 폭에 맞춰 재구성했다.
 *
 * 시간이 부족하면 이 순서로 잘라낸다:
 * 독서성향 리포트 → 레벨/뱃지 → 책나무·도장판 (CLAUDE.md §11).
 *
 * ⚠️ 레벨/뱃지·독서성향 리포트는 docs/spec.md 스키마에 없다 — 백엔드가 없어
 * 여기 정적 데모 콘텐츠로만 남겨둔다. 책나무·스트릭·장르 도장판만 GET /api/growth 를 쓴다.
 */
const TONE_BAR = {
  coral: "bg-coral",
  yellow: "bg-yellow",
  green: "bg-green-light",
} as const;

/** 레벨. 목업 5 L226-229. spec 에 없는 정적 데모 값 */
const LEVEL = {
  level: 4,
  title: "꾸준한 독서가",
  toNext: 260,
  progress: 0.72,
};

/** 뱃지. 목업 5 L235-240. spec 에 없는 정적 데모 값 */
const BADGES = [
  { icon: "🔖", label: "첫 책갈피", earned: true },
  { icon: "🔥", label: "7일 연속", earned: true },
  { icon: "📖", label: "10권 완독", earned: true },
  { icon: "🏆", label: "반 1위", earned: false },
];

/**
 * 독서성향 리포트. 목업 5 #3 (L198-232). spec 에 없는 정적 데모 값 —
 * 실제로는 누적된 독후감을 AI 가 요약해야 하지만 이 범위 밖이다 (CLAUDE.md §11).
 */
const READING_PROFILE = {
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

export function GrowthSection() {
  const [g, setG] = useState<GrowthResponse | null>(null);

  useEffect(() => {
    apiGet<GrowthResponse>("/api/growth")
      .then(setG)
      .catch(() => {
        // 조용히 실패한다 — 화면 곳곳의 값이 ?? 0/[] 로 떨어지는 것으로 충분하다
      });
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
          {g?.stamps.map((s) => {
            // 3의 배수(도장을 막 받은 시점)는 꽉 채우고, 그 외엔 진행 중인 만큼만 채운다.
            // % 3 만 쓰면 딱 3의 배수일 때 0/3(빈 원)으로 보여 "방금 도장 받음"이 사라진다.
            const filled =
              s.completed_count > 0 && s.completed_count % 3 === 0
                ? 3
                : s.completed_count % 3;
            return (
              <div key={s.genre} className="flex items-center gap-3">
                <span className="w-20 flex-none text-sm text-ink-soft">
                  {s.genre}
                </span>
                <div className="flex flex-1 gap-1">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <span
                      key={i}
                      className={`flex h-7 w-7 items-center justify-center rounded-full text-xs ${
                        i < filled
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
            );
          })}
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
