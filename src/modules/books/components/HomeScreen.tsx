"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { libraryHref } from "@/modules/reader";
import { apiGet } from "@/shared/api/client";
import type {
  Book,
  ClassRankingResponse,
  GrowthResponse,
  PointsResponse,
} from "@/shared/types";
import { Chip } from "@/shared/ui";
import { COVER, type CoverTone } from "../mock";

/**
 * 홈. 목업 7 #1 / 목업 8 #1 (보스전·성장 개편).
 *
 * 9/18 마감 스프린트(docs/sprint-0918.md) ① 로 갈래를 둘로 줄였다 — **책 읽기** 와
 * **독후감 쓰기**. 검색과 추천 카드는 여기서 뺐다.
 *
 * 검색을 왜 뺄 수 있었나: 검색은 사실상 "직접 작성" 진입로였고(#106), 그 화면이
 * 이미 /write 에 있다 (review 모듈의 PickBookFirst, #116). 그래서 홈에서 지워도
 * 종이책으로 읽고 온 학생의 경로는 그대로다 — "독후감 쓰기" 카드가 거기로 보낸다.
 * 추천은 읽을 책을 고르는 자리이므로 서재(/library)가 받는다.
 *
 * 책갈피·연속 기록·반 순위는 각 모듈 API 를 그대로 읽는다. 큰 카드 세 장 대신
 * 머리말의 칩 한 줄로 줄였다 — 홈의 주인공이 두 갈래 카드여야 하기 때문이다.
 */

const TONES: CoverTone[] = ["green", "coral", "blue", "yellow"];

/** 표지를 그리는 데 필요한 것만 */
type CoverBook = Pick<Book, "id" | "cover_url">;

/** 표지 URL 이 없으면 id 로 정해지는 토큰 그라데이션 (CLAUDE.md §10) */
function coverClass(book: CoverBook): string {
  const n = book.id.split("").reduce((sum, ch) => sum + ch.charCodeAt(0), 0);
  return COVER[TONES[n % TONES.length]];
}

function Cover({ book, size }: { book: CoverBook; size: string }) {
  if (book.cover_url) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- 외부 표지 URL, 크기 미상
      <img
        src={book.cover_url}
        alt=""
        className={`${size} flex-none rounded-md object-cover`}
      />
    );
  }
  return <div className={`${size} flex-none rounded-md ${coverClass(book)}`} />;
}

/** 쓰던 독후감 카드에 필요한 것. null 이면 그 줄을 그리지 않는다 */
export interface HomeDraft {
  id: string;
  title: string;
  cover_url: string | null;
}

/**
 * 이어서 읽을 책. null 이면 "서재에서 골라 읽기" 로 떨어진다.
 * review 모듈의 loadContinueReading 이 서버에서 채워 준다 (spec §2b 의 reading_progress).
 */
export interface HomeReading {
  bookId: string;
  title: string;
  readChapters: number;
  totalChapters: number;
}

export interface HomeScreenProps {
  draft?: HomeDraft | null;
  reading?: HomeReading | null;
}

export function HomeScreen({ draft, reading }: HomeScreenProps) {
  const [points, setPoints] = useState<number | null>(null);
  const [streak, setStreak] = useState<number | null>(null);
  const [rank, setRank] = useState<number | null>(null);

  useEffect(() => {
    apiGet<PointsResponse>("/api/points")
      .then((r) => setPoints(r.balance))
      .catch(() => {});
    apiGet<GrowthResponse>("/api/growth")
      .then((r) => setStreak(r.streak.current_days))
      .catch(() => {});
    apiGet<ClassRankingResponse>("/api/ranking/class")
      .then((r) => setRank(r.my_class.rank))
      .catch(() => {});
  }, []);

  const percent =
    reading && reading.totalChapters > 0
      ? Math.round((reading.readChapters / reading.totalChapters) * 100)
      : 0;

  return (
    <div className="flex flex-col gap-4">
      {/* 책갈피·순위는 머리말 칩으로. 주인공 자리는 아래 두 카드다 */}
      <div className="flex items-center justify-between gap-2">
        <span className="rounded-full bg-yellow-bg px-3 py-[7px] text-xs font-bold text-yellow-text">
          🔖 {points === null ? "—" : points.toLocaleString()}
        </span>
        {rank !== null && <Chip tone="blue">우리 반 {rank}위</Chip>}
      </div>

      <div>
        <h1 className="text-[26px] leading-[1.3] font-bold text-ink">
          오늘은 어떤 책을
          <br />
          잡아볼까?
        </h1>
        <p className="mt-2 text-sm text-muted">
          {streak === null
            ? "책을 읽고 독후감을 써 보자"
            : streak > 0
              ? `${streak}일째 연속 잡기 성공 🔥`
              : "오늘 한 권 읽고 연속 기록을 시작해 볼까?"}
        </p>
      </div>

      {/* ① 책 읽기 — 읽던 책이 있으면 이어서, 없으면 서재로 */}
      <Link
        href={reading ? libraryHref(reading.bookId) : "/library"}
        className="flex flex-col gap-4 rounded-[20px] bg-panel p-6"
      >
        <div className="flex items-center gap-3.5">
          <div className="flex h-14 w-14 flex-none items-center justify-center rounded-2xl bg-panel-inner text-2xl">
            📖
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-xl font-bold text-on-dark">책 읽기</div>
            <div className="mt-1 truncate text-[13px] text-on-dark-2">
              {reading
                ? `서재에서 이어 읽기 · ${reading.title}`
                : "책잇 서재에서 바로 읽을 수 있어"}
            </div>
          </div>
          <span className="flex-none text-[22px] text-coral">→</span>
        </div>

        {/* 표지 퍼즐과 같은 진행률 — 조각 = 읽은 장 (spec §2b) */}
        {reading && (
          <>
            <div className="h-2 overflow-hidden rounded-full bg-panel-line">
              <div
                className="h-2 rounded-full bg-coral"
                style={{ width: `${percent}%` }}
              />
            </div>
            <div className="text-xs text-panel-muted">
              {percent}% 읽음 · 표지 조각 {reading.readChapters}/
              {reading.totalChapters}
            </div>
          </>
        )}
      </Link>

      {/* ② 독후감 쓰기 — 초고가 있으면 이어서, 없으면 책 고르기(직접 작성) 화면 */}
      <Link
        href="/write"
        className="flex flex-col gap-4 rounded-[20px] border border-border-soft bg-card p-6"
      >
        <div className="flex items-center gap-3.5">
          <div className="flex h-14 w-14 flex-none items-center justify-center rounded-2xl bg-yellow-bg text-2xl">
            ✎
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-xl font-bold text-ink">독후감 쓰기</div>
            <div className="mt-1 text-[13px] text-muted">
              다 읽은 책으로 보스전 도전
            </div>
          </div>
          <span className="flex-none text-[22px] text-coral">→</span>
        </div>

        {draft && (
          <>
            <div className="h-px bg-border-soft" />
            <div className="flex items-center gap-3">
              <Cover book={draft} size="h-11 w-8.5" />
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-bold text-ink">
                  {draft.title}
                </div>
                <div className="mt-[3px] text-xs text-muted">
                  초고 저장됨 · 이어서 쓰기
                </div>
              </div>
              <Chip tone="yellow">진행 중</Chip>
            </div>
          </>
        )}

        <div className="text-xs text-faint">
          {/* 검색이 이 화면 안으로 들어왔다는 안내 — 홈에서 찾던 아이가 길을 잃지 않게 */}
          종이책으로 읽은 책도 여기서 제목을 찾아 쓸 수 있어
        </div>
      </Link>
    </div>
  );
}
