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
/** 도감 한 칸. 저학년 개편(목업 10 M08): 동그란 얼굴 + 이름 + 단계 칩. 표지 대신 얼굴이 주인공이다 */
function Slot({ entry }: { entry: CollectionEntryView }) {
  const captured = entry.stage === 2;
  const seen = entry.stage !== null;
  const seed = seedNumber(entry.artSeed || entry.bookId);

  if (!seen) {
    return (
      <div className="flex min-h-[150px] flex-col items-center justify-center gap-1.5 rounded-[22px] border-[3px] border-dashed border-dash bg-sunken px-2 py-3">
        <span aria-hidden className="text-[32px] opacity-40">❔</span>
        <span className="text-center text-[14px] leading-[1.4] font-medium text-faint">
          {/* 책 제목은 보여준다 — 71권 중 뭘 읽을지 고를 수 있어야 한다 */}
          <span className="block truncate px-1 text-[13px]">{entry.bookTitle}</span>
          아직 안 만난 친구
        </span>
      </div>
    );
  }

  const face = captured ? FACES[seed % FACES.length] : entry.stage === 0 ? "🥚" : "🐣";
  return (
    <div
      className={cn(
        "flex min-h-[150px] flex-col items-center gap-1.5 rounded-[22px] border-[3px] px-2 py-3",
        captured ? "border-coral-border bg-coral-bg" : "border-border bg-card",
      )}
    >
      <span
        aria-hidden
        className={cn(
          "flex h-[66px] w-[66px] items-center justify-center rounded-full text-[34px]",
          captured ? "bg-coral-bg-2" : entry.stage === 1 ? "bg-yellow-bg animate-[bookit-bob-s_3.4s_ease-in-out_infinite]" : "bg-sunken",
        )}
      >
        {face}
      </span>
      <span className="w-full truncate text-center font-display text-[16px] text-ink">
        {captured ? entry.name : entry.bookTitle}
      </span>
      <span
        className={cn(
          "rounded-full px-2.5 py-[3px] font-display text-[13px]",
          captured ? "bg-coral text-white" : entry.stage === 1 ? "bg-yellow text-yellow-text" : "bg-sunken text-ink-warm",
        )}
        title={captured && entry.stars !== null ? `보스전 ${"★".repeat(entry.stars)}` : undefined}
      >
        {captured ? (entry.stars ? "★".repeat(entry.stars) : "다 자람") : entry.stage === 1 ? "부화" : "알"}
      </span>
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
  const [stageFilter, setStageFilter] = useState<"all" | "grown" | "egg">("all");

  const shown = useMemo(() => {
    let list = tag === null ? entries : entries.filter((e) => e.tags.includes(tag));
    if (stageFilter === "grown") list = list.filter((e) => e.stage === 2);
    if (stageFilter === "egg") list = list.filter((e) => e.stage === 0 || e.stage === 1);
    return list;
  }, [entries, tag, stageFilter]);

  return (
    <div className="flex flex-col gap-3.5">
      <div className="flex items-center gap-2.5">
        <h1 className="text-[28px] text-ink">내 친구들</h1>
        <span className="rounded-full bg-coral-bg-2 px-[15px] py-1.5 font-display text-[18px] text-coral-ink">
          {captured} / {total}
        </span>
      </div>

      {/* 단계 필터 — 목업 M08 의 모두 / 다 자람 / 알 */}
      <div className="flex gap-2">
        {(
          [
            ["all", "모두"],
            ["grown", "다 자람"],
            ["egg", "알"],
          ] as const
        ).map(([v, label]) => (
          <button
            key={v}
            type="button"
            onClick={() => setStageFilter(v)}
            aria-pressed={stageFilter === v}
            className={cn(
              "min-h-12 rounded-full px-[18px] font-display text-[17px]",
              stageFilter === v ? "bg-coral text-white" : "border-2 border-border bg-card text-ink-mid",
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {/* 장르 칩. 책이 늘면 태그도 늘어서 가로로 흐르게 둔다 */}
      {tags.length > 0 && (
        <div className="-mx-[22px] flex gap-2 overflow-x-auto px-[22px] pb-1 [scrollbar-width:none]">
          {[null, ...tags].map((t) => (
            <button
              key={t ?? "all"}
              type="button"
              onClick={() => setTag(t)}
              aria-pressed={tag === t}
              className={cn(
                "flex min-h-11 flex-none items-center rounded-full px-[15px] font-display text-[15px] whitespace-nowrap",
                tag === t ? "bg-ink text-cream" : "border-2 border-border bg-card text-ink-warm",
              )}
            >
              {t ?? "전체"}
            </button>
          ))}
        </div>
      )}

      {shown.length === 0 ? (
        <p className="py-10 text-center text-[17px] text-muted">
          {stageFilter === "grown"
            ? "아직 다 자란 친구가 없어. 독후감을 통과하면 자라!"
            : tag === null
              ? "아직 도감에 책이 없어"
              : "이 장르에는 아직 친구가 없어"}
        </p>
      ) : (
        <div className="grid grid-cols-3 gap-3 md:grid-cols-5 lg:grid-cols-6">
          {shown.map((entry) => (
            <Slot key={entry.bookId} entry={entry} />
          ))}
        </div>
      )}

      <div className="rounded-[18px] bg-yellow-bg p-4 text-[15px] leading-relaxed text-yellow-text">
        ★ 은 보스전을 몇 번에 잡았는지야 · 한 번에 잡으면 ★★★
      </div>
    </div>
  );
}
