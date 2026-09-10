"use client";

import { useState } from "react";
import type { DictResponse } from "@/shared/types";
import { BottomSheet, Button, Card, Chip } from "@/shared/ui";
import { KNOWN_WORDS, TEXTS, lookup, type DemoText } from "../mock";

/**
 * 책잇 서재. 목업 6 L386-404.
 *
 * 본문은 18px / line-height 2 (CLAUDE.md §8).
 * 낱말을 누르면 뜻이 뜬다 — 768px 미만은 바텀시트, 이상은 우측 사이드 패널 (CLAUDE.md §8).
 *
 * ⚠️ 목 데이터로 도는 화면이다.
 */

/** 본문을 낱말 단위로 쪼개, 사전에 있는 낱말만 누를 수 있게 만든다. */
function Tappable({
  body,
  onTap,
}: {
  body: string;
  onTap: (word: string) => void;
}) {
  // 사전 표제어를 경계로 쪼갠다. 실제 구현에서는 형태소 분석이 필요하다.
  const pattern = new RegExp(`(${KNOWN_WORDS.join("|")})`, "g");
  const parts = body.split(pattern);

  return (
    <p className="text-[18px] leading-[2] text-ink-soft">
      {parts.map((p, i) =>
        KNOWN_WORDS.includes(p) ? (
          <button
            key={i}
            type="button"
            onClick={() => onTap(p)}
            className="border-b-2 border-b-coral text-coral-deep"
          >
            {p}
          </button>
        ) : (
          <span key={i}>{p}</span>
        ),
      )}
    </p>
  );
}

export function LibraryScreen() {
  const [open, setOpen] = useState<DemoText | null>(null);
  const [entry, setEntry] = useState<DictResponse | null>(null);

  const tap = async (word: string) => {
    setEntry(null);
    setEntry(await lookup(word));
  };

  if (open) {
    return (
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => {
              setOpen(null);
              setEntry(null);
            }}
            className="flex h-11 w-11 flex-none items-center justify-center text-muted"
            aria-label="서재로 돌아가기"
          >
            ←
          </button>
          <div className="min-w-0 flex-1">
            <div className="truncate text-[15px] font-bold text-ink">
              {open.title}
            </div>
            <div className="text-xs text-muted">{open.subtitle}</div>
          </div>
        </div>

        <div className="mt-4 flex min-h-0 flex-1 gap-6">
          <div className="min-w-0 flex-1 rounded-card bg-notebook p-5">
            <Tappable body={open.body} onTap={tap} />
            <p className="mt-6 text-xs text-faint">
              모르는 단어를 누르면 뜻이 떠요 ✎
            </p>
          </div>

          {/* 768px 이상 — 우측 사이드 패널 */}
          <aside className="hidden w-[270px] flex-none md:block">
            {entry ? (
              <Card raised>
                <div className="flex items-start justify-between gap-2">
                  <span className="text-base font-bold text-ink">
                    {entry.word}
                  </span>
                  <button
                    type="button"
                    onClick={() => setEntry(null)}
                    className="text-[13px] text-faint"
                    aria-label="닫기"
                  >
                    ✕
                  </button>
                </div>
                <p className="mt-2 text-[13px] leading-relaxed text-ink-warm">
                  {entry.definition}
                </p>
                <p className="mt-3 text-[11px] text-on-dark-2">{entry.source}</p>
              </Card>
            ) : (
              <p className="text-xs text-faint">낱말을 누르면 여기 뜻이 떠요</p>
            )}
          </aside>
        </div>

        {/* 768px 미만 — 바텀시트 */}
        <div className="md:hidden">
          <BottomSheet
            open={entry !== null}
            onClose={() => setEntry(null)}
            label="낱말 뜻"
          >
            <div className="text-xl font-bold text-ink">{entry?.word}</div>
            <p className="mt-2.5 text-[15px] leading-relaxed text-ink-warm">
              {entry?.definition}
            </p>
            <p className="mt-4 text-xs text-faint">{entry?.source}</p>
          </BottomSheet>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-[22px] font-bold text-ink">책잇 서재</h1>
        <p className="mt-1.5 text-[13px] text-muted">
          저작권이 풀린 책은 여기서 바로 읽을 수 있어
        </p>
      </div>

      <div className="flex flex-col gap-2.5">
        {TEXTS.map((t) => (
          <Card key={t.id} className="flex items-center gap-3">
            <div className="h-14 w-11 flex-none rounded-lg bg-linear-160 from-yellow to-yellow-text-2" />
            <div className="min-w-0 flex-1">
              <div className="truncate text-[15px] font-bold text-ink">
                {t.title}
              </div>
              <div className="mt-1 text-[13px] text-muted">{t.subtitle}</div>
            </div>
            <Chip tone="green">무료</Chip>
          </Card>
        ))}
      </div>

      <Button onClick={() => setOpen(TEXTS[0])}>첫 번째 책 읽기</Button>
    </div>
  );
}
