"use client";

import { useEffect, useState } from "react";
import type { GuardianSummaryResponse } from "@/shared/types";
import { Card, Chip } from "@/shared/ui";
import { getGuardianSummary } from "../mock";

/**
 * 보호자 화면. 목업 5 #2 (L120-140).
 *
 * 계정 없이 토큰 하나로 한 학생의 결과만 읽는다.
 * 독후감 본문은 없다 — 화면 아래에 그 사실을 명시한다 (목업 5 L167).
 */
export function GuardianView({ token }: { token: string }) {
  const [data, setData] = useState<GuardianSummaryResponse | null>(null);
  const [state, setState] = useState<"loading" | "ok" | "invalid">("loading");

  useEffect(() => {
    getGuardianSummary(token).then((d) => {
      setData(d);
      setState(d ? "ok" : "invalid");
    });
  }, [token]);

  if (state === "loading") {
    return (
      <div className="flex min-h-dvh items-center justify-center text-sm text-muted">
        불러오는 중…
      </div>
    );
  }

  if (state === "invalid" || !data) {
    return (
      <div className="flex min-h-dvh items-center justify-center px-6">
        <Card className="max-w-sm text-center">
          <div className="text-[17px] font-bold text-ink">
            링크가 만료되었어요
          </div>
          <p className="mt-2 text-sm leading-relaxed text-muted">
            아이에게 새 공유 링크를 받아주세요.
          </p>
        </Card>
      </div>
    );
  }

  const { summary, books } = data;

  return (
    <div className="mx-auto flex min-h-dvh max-w-3xl flex-col gap-4 px-6 py-8">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 flex-none items-center justify-center rounded-xl bg-ink text-base font-bold text-on-dark">
          ▯▯
        </div>
        <div>
          <div className="text-[19px] font-bold text-ink">
            {summary.display_name}이의 독서 현황
          </div>
          <div className="mt-0.5 text-[13px] text-muted">
            읽기 전용 · 계정 없이 볼 수 있어요
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3.5 md:grid-cols-4">
        <div className="rounded-[14px] bg-panel p-5">
          <div className="text-xs text-on-dark-2">이번 주 완료</div>
          <div className="mt-1.5 text-[26px] font-bold text-on-dark">
            {summary.completed_count}권
          </div>
        </div>
        <Card>
          <div className="text-xs text-muted">누적 책갈피</div>
          <div className="mt-1.5 text-[26px] font-bold text-ink">
            {summary.points.toLocaleString()}
          </div>
        </Card>
        <Card>
          <div className="text-xs text-muted">평균 이해도</div>
          <div className="mt-1.5 text-[26px] font-bold text-green">
            {summary.avg_score}점
          </div>
        </Card>
        <Card>
          <div className="text-xs text-muted">연속 기록</div>
          <div className="mt-1.5 text-[26px] font-bold text-coral">7일</div>
        </Card>
      </div>

      <Card>
        <div className="text-[13px] text-muted">읽은 책</div>
        {books.map((b) => (
          <div
            key={b.title}
            className="flex items-center gap-3 border-b border-border-soft py-3 last:border-b-0"
          >
            <div className="h-10 w-8 flex-none rounded-lg bg-linear-160 from-green-light to-green" />
            <div className="min-w-0 flex-1">
              <div className="truncate text-[15px] font-bold text-ink">
                {b.title}
              </div>
              <div className="text-[13px] text-muted">{b.author}</div>
            </div>
            {b.passed ? (
              <Chip tone="green">완독</Chip>
            ) : (
              <Chip tone="neutral">읽는 중</Chip>
            )}
          </div>
        ))}
      </Card>

      {/* 목업 5 L167 */}
      <div className="rounded-card bg-yellow-bg p-4">
        <div className="text-[15px] font-bold text-yellow-text">
          독후감 원문은 비공개예요
        </div>
        <p className="mt-1.5 text-sm leading-relaxed text-yellow-text-2">
          아이가 직접 공개하지 않는 한 글 내용은 누구에게도 보이지 않아요.
          결과와 점수만 공유됩니다.
        </p>
      </div>
    </div>
  );
}
