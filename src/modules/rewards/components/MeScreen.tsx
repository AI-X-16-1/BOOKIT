"use client";

import { useEffect, useState } from "react";
import type { ExchangeKind, PointsResponse } from "@/shared/types";
import { Button, Card, Chip } from "@/shared/ui";
import { COVER } from "@/modules/books";
import {
  EXCHANGE_COST,
  EXCHANGE_LABEL,
  REASON_LABEL,
  exchange,
  getPoints,
} from "../mock";

/**
 * 나 — 책갈피·교환·읽은 책. 목업 4 #1 (L36-86).
 *
 * 교환을 누르면 원장에 차감 행이 쌓이고 잔액이 즉시 줄어든다.
 * 잔액은 저장된 값이 아니라 sum(delta) 로 다시 계산된다 (CLAUDE.md §4).
 *
 * ⚠️ 목 데이터로 도는 화면이다. 새로고침하면 초기 상태로 돌아간다.
 */
const READ_BOOKS = [
  { title: "아몬드", score: 100, cover: "green" as const },
  { title: "완득이", score: 83, cover: "coral" as const },
  { title: "마당을 나온 암탉", score: 100, cover: "yellow" as const },
];

export function MeScreen() {
  const [points, setPoints] = useState<PointsResponse | null>(null);
  const [busy, setBusy] = useState<ExchangeKind | null>(null);
  const [note, setNote] = useState<string | null>(null);

  useEffect(() => {
    getPoints().then(setPoints);
  }, []);

  const doExchange = async (kind: ExchangeKind) => {
    setBusy(kind);
    setNote(null);
    try {
      const r = await exchange(kind);
      setPoints(await getPoints());
      setNote(`${EXCHANGE_LABEL[kind]}을 받았어! 잔액 ${r.balance.toLocaleString()}`);
    } catch {
      setNote("책갈피가 모자라. 조금만 더 모아볼까?");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3.5">
        <div className="flex h-14 w-14 flex-none items-center justify-center rounded-full bg-yellow text-xl font-bold text-stamp-text">
          민
        </div>
        <div>
          <div className="text-xl font-bold text-ink">민서 · 5학년 2반</div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <Chip tone="yellow">Lv.4 꾸준한 독서가</Chip>
            <Chip tone="blue">🏅 첫 책갈피</Chip>
          </div>
        </div>
      </div>

      <div className="rounded-card bg-panel p-5">
        <div className="text-[13px] text-on-dark-2">모은 책갈피</div>
        <div className="mt-1.5 text-[34px] leading-none font-bold text-on-dark">
          {points ? points.balance.toLocaleString() : "—"}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2.5">
        <Card>
          <div className="text-[13px] text-muted">연속 기록 🔥</div>
          <div className="mt-1.5 text-[26px] font-bold text-ink">7일</div>
        </Card>
        <Card>
          <div className="text-[13px] text-muted">우리 반 순위</div>
          <div className="mt-1.5 text-[26px] font-bold text-coral">2위</div>
        </Card>
      </div>

      <Card>
        <div className="text-[13px] text-muted">읽은 책</div>
        {READ_BOOKS.map((b) => (
          <div
            key={b.title}
            className="flex items-center gap-3 border-b border-border-soft py-2.5 last:border-b-0"
          >
            <div className={`h-8 w-8 flex-none rounded-lg ${COVER[b.cover]}`} />
            <span className="flex-1 truncate text-base font-bold text-ink">
              {b.title}
            </span>
            <span className="text-sm text-green">{b.score}점</span>
          </div>
        ))}
      </Card>

      {/* 교환 — 누르면 실제로 잔액이 줄어든다 */}
      <div className="rounded-card bg-yellow-bg p-4">
        <div className="text-[13px] text-yellow-text-2">책갈피 교환하기</div>
        <div className="mt-2.5 flex flex-col gap-2">
          <Button
            variant="dark"
            disabled={busy !== null}
            onClick={() => doExchange("ebook")}
          >
            {busy === "ebook"
              ? "교환하는 중…"
              : `📖 ${EXCHANGE_LABEL.ebook} (${EXCHANGE_COST.ebook})`}
          </Button>
          <Button
            variant="outline"
            disabled={busy !== null}
            onClick={() => doExchange("audiobook")}
          >
            {busy === "audiobook"
              ? "교환하는 중…"
              : `🎧 ${EXCHANGE_LABEL.audiobook} (${EXCHANGE_COST.audiobook})`}
          </Button>
        </div>
        {note && (
          <p className="mt-3 text-center text-[13px] text-yellow-text">{note}</p>
        )}
      </div>

      {/* 원장 — append-only 라 차감도 한 줄로 쌓인다 */}
      <Card>
        <div className="text-[13px] text-muted">책갈피 기록</div>
        <div className="mt-1">
          {points?.ledger.map((row) => (
            <div
              key={row.id}
              className="flex items-center gap-3 border-b border-border-soft py-2.5 text-sm last:border-b-0"
            >
              <span className="flex-1 truncate text-ink">
                {REASON_LABEL[row.reason] ?? row.reason}
              </span>
              <span
                className={`font-bold ${row.delta > 0 ? "text-green" : "text-coral"}`}
              >
                {row.delta > 0 ? "+" : ""}
                {row.delta}
              </span>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
