"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { faceOf, libraryHref, pickPartner } from "@/modules/reader";
import { apiGet } from "@/shared/api/client";
import type {
  Book,
  BookRecommendResponse,
  CharactersResponse,
  CharacterView,
  GrowthResponse,
  MeResponse,
  PointsResponse,
} from "@/shared/types";
import { cn } from "@/shared/ui";
import { COVER, type CoverTone } from "../mock";

/**
 * 홈. 저학년 개편 — 목업 10 M02 / 목업 9 (2026-09-20).
 *
 * 위에서부터: 인사 + 🔥 연속 + 🔖 책갈피 → 지금 키우는 친구(캐릭터) 카드 + 진행바 →
 * 오늘의 미션 칩 → 쓰다 만 독후감(어두운 카드) → 너한테 딱 맞는 책 2열.
 *
 * 9/18 의 "두 갈래" 원칙은 지킨다 — 캐릭터 카드가 **책 읽기**(서재로), 어두운 카드가
 * **독후감 쓰기**(/write 로) 다. 검색은 여전히 /write 안에 있다 (#106·#116).
 *
 * 캐릭터 단계는 클라이언트가 계산하지 않는다 — /api/characters 의 stage 를 그대로 읽는다
 * (docs/mockups/README-kids-redesign.md). 얼굴 이모지는 reader 의 faceOf 와 같은 규칙.
 */

const TONES: CoverTone[] = ["green", "coral", "blue", "yellow"];

/** 표지를 그리는 데 필요한 것만 */
type CoverBook = Pick<Book, "id" | "cover_url">;

/** 표지 URL 이 없으면 id 로 정해지는 토큰 그라데이션 (CLAUDE.md §10) */
function coverClass(book: CoverBook): string {
  const n = book.id.split("").reduce((sum, ch) => sum + ch.charCodeAt(0), 0);
  return COVER[TONES[n % TONES.length]];
}

function Cover({ book, className }: { book: CoverBook; className: string }) {
  if (book.cover_url) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- 외부 표지 URL, 크기 미상
      <img src={book.cover_url} alt="" className={cn("object-cover", className)} />
    );
  }
  return <div className={cn(coverClass(book), className)} />;
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

/** 단계별 한 줄 — 목업 10 의 stageLine */
function stageLine(stage: 0 | 1 | 2, left: number): string {
  if (stage === 2) return left > 0 ? "다 자란 친구랑 마저 읽자" : "다 자랐어! 도감에 들어갔어";
  if (stage === 1) return left <= 1 ? "한 장만 더 읽으면 부화!" : `${left}장 더 읽으면 부화해`;
  return "첫 장을 읽으면 깨어나";
}

export function HomeScreen({ draft, reading }: HomeScreenProps) {
  const [name, setName] = useState<string | null>(null);
  const [points, setPoints] = useState<number | null>(null);
  const [streak, setStreak] = useState<number | null>(null);
  const [characters, setCharacters] = useState<CharacterView[]>([]);
  const [picks, setPicks] = useState<Book[]>([]);

  useEffect(() => {
    apiGet<MeResponse>("/api/profile")
      .then((r) => setName(r.display_name))
      .catch(() => {});
    apiGet<PointsResponse>("/api/points")
      .then((r) => setPoints(r.balance))
      .catch(() => {});
    apiGet<GrowthResponse>("/api/growth")
      .then((r) => setStreak(r.streak.current_days))
      .catch(() => {});
    apiGet<CharactersResponse>("/api/characters")
      .then((r) => setCharacters(r.characters))
      .catch(() => {});
    apiGet<BookRecommendResponse>("/api/books/recommend")
      .then((r) => setPicks(r.books.slice(0, 5)))
      .catch(() => {});
  }, []);

  // 카드의 주인공: 읽던 책의 친구 → 없으면 가장 자란 친구 → 없으면 알
  const current = reading ? characters.find((c) => c.book_id === reading.bookId) : undefined;
  const partner = current
    ? {
        face: faceOf(current.stage as 0 | 1 | 2, current.art_seed, current.book_id),
        name: current.stage_name,
        stage: current.stage as 0 | 1 | 2,
      }
    : pickPartner(characters);
  const left = reading ? Math.max(reading.totalChapters - reading.readChapters, 0) : 0;
  const percent =
    reading && reading.totalChapters > 0
      ? Math.round((reading.readChapters / reading.totalChapters) * 100)
      : 0;

  const grown = characters.filter((c) => c.stage === 2).length;

  return (
    <div className="flex flex-col gap-4">
      {/* 인사 + 연속 + 책갈피 */}
      <div className="flex flex-wrap items-center gap-2.5">
        <h1 className="text-[28px] text-ink">{name ? `${name}아, 안녕!` : "안녕!"}</h1>
        {streak !== null && streak > 0 && (
          <span className="rounded-full bg-yellow-bg px-3 py-1.5 font-display text-[17px] text-yellow-text">
            🔥 {streak}일째
          </span>
        )}
        <span className="ml-auto flex items-center gap-1.5 rounded-full border-2 border-border bg-card px-3.5 py-1.5">
          <span aria-hidden className="text-[17px]">🔖</span>
          <span className="font-display text-[21px] text-ink">
            {points === null ? "—" : points.toLocaleString()}
          </span>
        </span>
      </div>

      {/* ① 책 읽기 — 지금 키우는 친구. 읽던 책이 있으면 이어서, 없으면 서재로 */}
      <Link
        href={reading ? libraryHref(reading.bookId, reading.readChapters + 1) : "/library"}
        className="relative flex flex-col items-center gap-2 overflow-hidden rounded-[28px] border-[3px] border-coral-border bg-coral-bg p-5"
      >
        <span aria-hidden className="absolute top-3.5 right-5 text-[17px] animate-[bookit-twinkle_2.4s_ease-in-out_infinite]">✨</span>
        <span aria-hidden className="absolute top-[52px] left-6 text-[13px] animate-[bookit-twinkle_2.4s_ease-in-out_.8s_infinite]">✨</span>
        <span
          aria-hidden
          className="flex h-[132px] w-[132px] items-center justify-center rounded-full text-[70px] animate-[bookit-bob_4s_ease-in-out_infinite]"
          style={{ background: "radial-gradient(circle at 50% 35%, #FFE3D9, #FFCDBD)" }}
        >
          {partner?.face ?? "🥚"}
        </span>
        <span className="text-[15px] font-medium text-coral-muted">
          {reading ? `${reading.title}` : partner ? partner.name : "책을 펼치면 알을 받아"}
        </span>
        <span className="text-center font-display text-[25px] text-ink">
          {reading
            ? partner
              ? stageLine(partner.stage, left)
              : "이어서 읽어볼까?"
            : partner
              ? `${partner.name}이랑 새 책 읽으러 가자`
              : "오늘은 어떤 책을 읽어볼까?"}
        </span>
        {reading && (
          <>
            <span className="mt-1 h-[18px] w-full overflow-hidden rounded-full bg-coral-bg-2">
              <span
                className="block h-full rounded-full transition-[width] duration-700"
                style={{ width: `${Math.max(percent, 4)}%`, background: "linear-gradient(90deg, #FF8F75, #FF6B4A)" }}
              />
            </span>
            <span className="text-[15px] font-medium text-coral-muted">
              {reading.totalChapters}장 중 {reading.readChapters}장 읽었어
            </span>
          </>
        )}
      </Link>

      {/* 오늘의 미션 — 셋 다 화면에 이미 있는 값으로만 판단한다 */}
      <div className="-mx-1 flex gap-2.5 overflow-x-auto px-1 pb-1 [scrollbar-width:none]">
        <Mission done={!!reading && reading.readChapters > 0} label="한 장 읽기" />
        <Mission done={!!draft} label={draft ? "독후감 쓰는 중" : "독후감 1개"} />
        <Mission done={grown > 0} label={grown > 0 ? `친구 ${grown}마리` : "새 친구"} />
      </div>

      {/* ② 독후감 쓰기 — 초고가 있으면 이어서, 없으면 책 고르기(직접 작성) 화면 */}
      <Link
        href="/write"
        className="flex items-center gap-3.5 rounded-[26px] bg-ink px-5 py-[18px] text-on-dark"
      >
        {draft && <Cover book={draft} className="h-14 w-[42px] flex-none rounded-[10px]" />}
        <span className="min-w-0 flex-1">
          <span className="block text-[14px] font-medium text-on-dark-2">
            {draft ? "쓰다 만 독후감" : "다 읽은 책이 있어?"}
          </span>
          <span className="mt-0.5 block truncate font-display text-[22px]">
            {draft ? draft.title : "독후감 쓰기"}
          </span>
          <span className="block text-[14px] font-medium text-on-dark-2">
            {draft ? "이어서 쓰면 돼" : "종이책도 제목 찾아서 쓸 수 있어"}
          </span>
        </span>
        <span className="flex h-[54px] flex-none items-center rounded-[18px] bg-yellow px-5 font-display text-[19px] text-[#4A3A10]">
          {draft ? "이어서 ✏️" : "쓰기 ✏️"}
        </span>
      </Link>

      {/* 너한테 딱 맞는 책 — 추천 API. 서재 책은 바로 읽기, 아니면 독후감 쓰기 */}
      {picks.length > 0 && (
        <>
          <div className="mt-1 flex items-baseline gap-2.5">
            <h2 className="text-[23px] text-ink">너한테 딱 맞는 책</h2>
            <span className="text-[14px] font-medium text-muted">지금 인기</span>
          </div>
          <div className="grid grid-cols-2 gap-3.5 md:grid-cols-4 xl:grid-cols-5">
            {picks.map((b) => (
              <Link key={b.id} href={b.is_public_domain ? libraryHref(b.id) : `/write?book=${b.id}`} className="block">
                <span className="relative block h-[196px] overflow-hidden rounded-[20px] border-[3px] border-card bg-sunken shadow-[0_8px_20px_rgba(90,66,40,.14)]">
                  <Cover book={b} className="block h-full w-full" />
                  {b.is_public_domain && (
                    <span className="absolute top-2 left-2 rounded-full bg-green px-2.5 py-1 font-display text-[14px] text-white">
                      바로 읽기
                    </span>
                  )}
                </span>
                <span className="mt-1.5 block truncate font-display text-[19px] text-ink">{b.title}</span>
                <span className="block truncate text-[14px] font-medium text-muted">{b.author}</span>
              </Link>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function Mission({ done, label }: { done: boolean; label: string }) {
  return (
    <span
      className={cn(
        "flex flex-none items-center gap-1.5 rounded-full px-4 py-2 font-display text-[17px]",
        done ? "bg-green-bg text-green-ink" : "border-2 border-border bg-card text-coral-text-2",
      )}
    >
      {done ? "✓" : "○"} {label}
    </span>
  );
}
