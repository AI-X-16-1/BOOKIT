"use client";

import { useMemo, useState } from "react";
import { cn } from "@/shared/ui";

/**
 * 도감. 목업 7 #5 · 목업 8 #4 (docs/mockups/7 보스전·성장 개편 (모바일).dc.html).
 *
 * 9/18 마감 스프린트(docs/sprint-0918.md) ② — "표지 + 캐릭터 합성".
 * 합성은 말 그대로다: 칸 하나가 **그 책의 표지**이고, 그 위에 캐릭터가 앉는다.
 * 캐릭터 그림 파일은 없다 (spec §2b `art_seed`) — 표지(없으면 토큰 그라데이션) 위에
 * 씨앗으로 고른 이모지를 얹어 그린다.
 *
 * 잡은 것만 보여주지 않는다. 아직 못 잡은 칸도 남겨야 "다음에 뭘 잡을까" 가 생긴다 —
 * 목업의 "미포획" 칸이 그것이다. 대신 못 잡은 칸은 캐릭터 이름을 가린다.
 *
 * 순수 표시용이다. 진화(stage 를 올리는 쪽)는 0014 트리거가 하고 이 화면은 읽기만 한다.
 */

/** 표지가 없을 때 쓰는 자리표시자 (CLAUDE.md §10). books 모듈의 COVER 와 같은 네 쌍이다 —
 *  그쪽은 모듈 내부 파일이라 가져올 수 없어(CLAUDE.md §2) 같은 값을 여기 적어 둔다 */
const COVER_TONES = [
  "bg-linear-160 from-green-light to-green",
  "bg-linear-160 from-coral-light to-coral",
  "bg-linear-160 from-blue to-blue-text",
  "bg-linear-160 from-yellow to-yellow-text-2",
];

/** 캐릭터 얼굴. art_seed 로 고른다 — 같은 책은 늘 같은 얼굴이 나온다 */
const FACES = ["🐉", "🦊", "🐢", "🦉", "🐯", "🐰", "🐻", "🦋"];

/** 문자열 → 안정적인 양수. 표지 색과 얼굴을 고르는 데만 쓴다 */
function seedNumber(seed: string): number {
  let n = 0;
  for (const ch of seed) n = (n * 31 + ch.charCodeAt(0)) % 100000;
  return n;
}

export interface CollectionEntryView {
  bookId: string;
  bookTitle: string;
  coverUrl: string | null;
  tags: string[];
  name: string;
  artSeed: string;
  /** null = 아직 펼치지도 않은 책 */
  stage: 0 | 1 | 2 | null;
  stageName: string | null;
  obtainedAt: string | null;
  stars: number | null;
}

export interface CollectionScreenProps {
  entries: CollectionEntryView[];
  captured: number;
  total: number;
  tags: string[];
}

/** 한 칸 */
function Slot({ entry }: { entry: CollectionEntryView }) {
  const captured = entry.stage === 2;
  const seen = entry.stage !== null;
  const seed = seedNumber(entry.artSeed || entry.bookId);

  return (
    <div
      className={cn(
        "rounded-2xl p-2.5",
        captured ? "border border-border bg-card" : "bg-sunken",
      )}
    >
      <div
        className={cn(
          "relative flex aspect-3/4 items-end justify-center overflow-hidden rounded-[10px] pb-1.5",
          !entry.coverUrl && COVER_TONES[seed % COVER_TONES.length],
        )}
      >
        {entry.coverUrl && (
          // eslint-disable-next-line @next/next/no-img-element -- 외부 표지 URL, 크기 미상
          <img
            src={entry.coverUrl}
            alt=""
            className="absolute inset-0 h-full w-full object-cover"
          />
        )}

        {/* 아직 못 잡았으면 표지를 덮는다 — 표지 퍼즐과 같은 규칙이다.
            다 잡으면 표지가 드러나고 그 위에 캐릭터가 앉는다 */}
        {!captured && (
          <div className="absolute inset-0 flex items-center justify-center bg-sunken/92 text-2xl text-faint">
            {seen ? (entry.stage === 0 ? "🥚" : "🐣") : "?"}
          </div>
        )}

        {captured && (
          <>
            <span className="relative text-4xl drop-shadow-[0_2px_6px_rgba(0,0,0,.45)]" aria-hidden>
              {FACES[seed % FACES.length]}
            </span>
            {entry.stars !== null && (
              <span
                className="absolute top-1.5 left-1.5 rounded-full bg-yellow px-[7px] py-[3px] text-[9px] font-bold text-stamp-text"
                title="보스전을 몇 번에 잡았는지"
              >
                {"★".repeat(entry.stars)}
              </span>
            )}
          </>
        )}
      </div>

      <div
        className={cn(
          "mt-2.5 truncate text-xs font-bold",
          captured ? "text-ink" : "text-muted",
        )}
      >
        {captured ? entry.bookTitle : "미포획"}
      </div>
      <div className="mt-[2px] truncate text-[11px] text-faint">
        {captured ? entry.name : seen ? `${entry.stageName} · 읽는 중` : "-"}
      </div>
    </div>
  );
}

export function CollectionScreen({
  entries,
  captured,
  total,
  tags,
}: CollectionScreenProps) {
  const [tag, setTag] = useState<string | null>(null);

  const shown = useMemo(
    () => (tag === null ? entries : entries.filter((e) => e.tags.includes(tag))),
    [entries, tag],
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-[22px] font-bold text-ink">나의 도감</h1>
          <p className="mt-[5px] text-[13px] text-muted">
            포획한 책이 캐릭터가 되어 들어와요
          </p>
        </div>
        <span className="flex-none rounded-xl bg-panel px-3.5 py-2.5 text-[13px] font-bold text-yellow">
          {captured} / {total}
        </span>
      </div>

      {/* 장르 칩. 책이 늘면 태그도 늘어서 가로로 흐르게 둔다 */}
      {tags.length > 0 && (
        <div className="-mx-[22px] flex gap-2 overflow-x-auto px-[22px] pb-1">
          {[null, ...tags].map((t) => (
            <button
              key={t ?? "all"}
              type="button"
              onClick={() => setTag(t)}
              aria-pressed={tag === t}
              className={cn(
                "min-h-9 flex-none rounded-full px-[15px] py-[9px] text-[13px] whitespace-nowrap",
                tag === t
                  ? "bg-ink font-bold text-cream"
                  : "border border-border bg-card text-ink-warm",
              )}
            >
              {t ?? "전체"}
            </button>
          ))}
        </div>
      )}

      {shown.length === 0 ? (
        <p className="py-10 text-center text-sm text-muted">
          이 장르에는 아직 캐릭터가 없어
        </p>
      ) : (
        <div className="grid grid-cols-3 gap-3 md:grid-cols-5 lg:grid-cols-6">
          {shown.map((entry) => (
            <Slot key={entry.bookId} entry={entry} />
          ))}
        </div>
      )}

      <div className="rounded-2xl bg-yellow-bg p-[18px] text-[13px] leading-relaxed text-yellow-text">
        ★ 등급은 보스전을 몇 번에 잡았는지로 정해져요 · 한 번에 잡으면 ★★★
      </div>
    </div>
  );
}
