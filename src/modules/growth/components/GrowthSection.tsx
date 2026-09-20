"use client";

import { useEffect, useState } from "react";
import type { GrowthResponse } from "@/shared/types";
import { apiGet } from "@/shared/api/client";
import { Card, Chip } from "@/shared/ui";
import { TREE_STAGES } from "../schema";

/**
 * 성장 — 책나무 · 장르 도장판.
 *
 * #71 결정: 레벨/뱃지·독서성향 리포트는 docs/spec.md 스키마에 없는 정적 데모 값이라
 * 뺐다 — 독후감을 한 편도 안 쓴 계정에도 "Lv.4 꾸준한 독서가", "독후감 12편을 모아
 * 분석했어요" 같은 문구가 그대로 떴다. 책나무·스트릭·장르 도장판만 실제 데이터
 * (GET /api/growth) 라 남긴다. CLAUDE.md §11 컷 순서(독서성향 리포트 → 레벨/뱃지)와도 맞는다.
 */

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
      {/* 저학년 개편(목업 10 M08 아래 카드): 동그란 나무 + "나의 책나무 12/15" + 진행바 */}
      <Card className="flex items-center gap-3.5">
        <span aria-hidden className="flex h-16 w-16 flex-none items-center justify-center rounded-full bg-green-bg text-[32px]">
          {TREE_STAGES[Math.min(g?.tree_stage ?? 0, TREE_STAGES.length - 1)]}
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-[20px] text-ink">
            나의 책나무 <span className="text-green-text">잎 {g?.leaves ?? 0}장</span>
          </h2>
          <p className="text-[15px] font-medium text-muted">한 권 다 읽을 때마다 잎이 한 장 자라</p>
          <div className="mt-2 h-3.5 w-full overflow-hidden rounded-full bg-green-bg">
            <div
              className="h-full rounded-full bg-green transition-[width] duration-700"
              style={{ width: `${Math.min(((g?.leaves ?? 0) % 5) * 20 + (g?.leaves ? 8 : 0), 100)}%` }}
            />
          </div>
        </div>
      </Card>

      {/* 장르 도장판 — 3권당 도장 1개 */}
      <Card>
        <h2 className="text-[20px] text-ink">장르 도장판</h2>
        <p className="text-[15px] font-medium text-muted">같은 장르 3권이면 도장 하나</p>
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
                <span className="w-20 flex-none font-display text-[17px] text-ink-soft">
                  {s.genre}
                </span>
                <div className="flex flex-1 gap-1">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <span
                      key={i}
                      className={`flex h-9 w-9 items-center justify-center rounded-full text-[15px] ${
                        i < filled
                          ? "bg-yellow text-stamp-text"
                          : "bg-sunken text-faint"
                      }`}
                    >
                      ★
                    </span>
                  ))}
                </div>
                <span className="flex-none text-[15px] font-medium text-muted">
                  {s.completed_count}권
                </span>
                {s.stamps > 0 && <Chip tone="yellow">도장 {s.stamps}</Chip>}
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}
