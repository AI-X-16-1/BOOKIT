"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { apiGet } from "@/shared/api/client";
import type {
  Book,
  BookRecommendResponse,
  BookSearchResponse,
  ClassRankingResponse,
  GrowthResponse,
  PointsResponse,
} from "@/shared/types";
import { Card, Chip } from "@/shared/ui";
import { COVER, type CoverTone } from "../mock";

/**
 * 홈. 목업 6 L127-140 (인사·검색), 목업 4 (책갈피·스트릭 카드).
 *
 * 검색·추천은 books API, 책갈피·스트릭·반 순위는 각 모듈의 API 를 읽는다.
 * 책 카드는 전부 /write?book=<id> 로 간다 — review 모듈이 그 책의 초고를 만든다.
 * "이어서 쓰기"는 /write 가 가장 최근 초고를 스스로 찾으므로 여기서는 링크만 둔다.
 */

const TONES: CoverTone[] = ["green", "coral", "blue", "yellow"];

/** 표지 URL 이 없으면 id 로 정해지는 토큰 그라데이션 (CLAUDE.md §10) */
function coverClass(book: Book): string {
  const n = book.id.split("").reduce((sum, ch) => sum + ch.charCodeAt(0), 0);
  return COVER[TONES[n % TONES.length]];
}

function Cover({ book, size }: { book: Book; size: string }) {
  if (book.cover_url) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- 외부 표지 URL, 크기 미상
      <img
        src={book.cover_url}
        alt=""
        className={`${size} flex-none rounded-[10px] object-cover`}
      />
    );
  }
  return (
    <div className={`${size} flex-none rounded-[10px] ${coverClass(book)}`} />
  );
}

export function HomeScreen() {
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<Book[]>([]);
  const [searching, setSearching] = useState(false);
  const [recommend, setRecommend] = useState<BookRecommendResponse | null>(
    null,
  );
  const [points, setPoints] = useState<number | null>(null);
  const [streak, setStreak] = useState<number | null>(null);
  const [rank, setRank] = useState<number | null>(null);

  useEffect(() => {
    apiGet<BookRecommendResponse>("/api/books/recommend")
      .then(setRecommend)
      .catch(() => {});
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

  // 300ms 디바운스 검색. 외부 API 라 응답이 늦을 수 있어 늦게 온 이전 결과는 버린다.
  // 상태 갱신은 전부 타이머·응답 콜백 안에서만 한다 (react-hooks/set-state-in-effect).
  useEffect(() => {
    const query = q.trim();
    let alive = true;
    const t = setTimeout(
      () => {
        if (!query) {
          setHits([]);
          setSearching(false);
          return;
        }
        setSearching(true);
        apiGet<BookSearchResponse>(
          `/api/books/search?q=${encodeURIComponent(query)}`,
        )
          .then((r) => {
            if (alive) setHits(r.books);
          })
          .catch(() => {
            if (alive) setHits([]);
          })
          .finally(() => {
            if (alive) setSearching(false);
          });
      },
      query ? 300 : 0,
    );
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [q]);

  const showResults = q.trim().length > 0;

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-[26px] leading-tight font-bold text-ink">
          오늘도 책갈피 모으러 가볼까?
        </h1>
        <p className="mt-2 text-[13px] text-muted">
          {streak === null
            ? "책을 읽고 독후감을 써 보자"
            : streak > 0
              ? `${streak}일째 연속으로 오고 있어요 🔥`
              : "오늘 한 권 읽고 연속 기록을 시작해 볼까?"}
        </p>
      </div>

      {/* 검색 — 결과를 누르면 그 책으로 독후감을 쓴다. 결과는 겹쳐 띄운다 (레이아웃 밀림 = CLS 방지) */}
      <div className="relative">
        <div className="flex items-center gap-2 rounded-xl border-[1.5px] border-coral bg-card px-3.5 py-3">
          <span className="text-faint">⌕</span>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="읽고 싶은 책을 찾아봐"
            className="min-w-0 flex-1 bg-transparent text-sm text-ink outline-none placeholder:text-faint"
          />
        </div>
        {/* 헤더·닫기가 있는 불투명 박스를 위에 띄운다 — 아래 추천 카드와 구분되고, 홈 컴포넌트는 밀리지 않는다 */}
        {showResults && (
          <div className="absolute inset-x-0 top-full z-20 mt-2 max-h-[60vh] overflow-y-auto rounded-xl border-[1.5px] border-border-strong bg-card shadow-card">
            <div className="flex items-center justify-between border-b border-border-soft bg-notebook px-4 py-2.5">
              <span className="text-[13px] font-bold text-muted">
                {searching
                  ? "찾는 중…"
                  : `'${q.trim()}' 검색 결과 ${hits.length}개`}
              </span>
              <button
                type="button"
                onClick={() => setQ("")}
                aria-label="검색 닫기"
                className="flex h-8 w-8 items-center justify-center rounded-full text-muted"
              >
                ✕
              </button>
            </div>
            <ul>
              {hits.map((b) => (
                <li
                  key={b.id}
                  className="border-b border-border-soft last:border-b-0"
                >
                  <Link
                    href={`/write?book=${b.id}`}
                    className="flex min-h-12 items-center gap-3 px-4 py-3"
                  >
                    <Cover book={b} size="h-8 w-8" />
                    <span className="flex-1 truncate text-[15px] font-bold text-ink">
                      {b.title}
                    </span>
                    <span className="text-[13px] text-muted">{b.author}</span>
                  </Link>
                </li>
              ))}
              {hits.length === 0 && !searching && (
                <li className="px-4 py-3 text-[14px] text-muted">
                  그 책은 못 찾았어. 다른 제목으로 찾아볼까?
                </li>
              )}
            </ul>
          </div>
        )}
      </div>

      {
        <>
          {/* 책갈피 */}
          <div className="rounded-card bg-panel p-5">
            <div className="text-[13px] text-on-dark-2">모은 책갈피</div>
            <div className="mt-1.5 text-[34px] leading-none font-bold text-on-dark">
              {points === null ? "—" : points.toLocaleString()}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            <Card>
              <div className="text-[13px] text-muted">연속 기록 🔥</div>
              <div className="mt-1.5 text-[26px] font-bold text-ink">
                {streak === null ? "—" : `${streak}일`}
              </div>
            </Card>
            <Card>
              <div className="text-[13px] text-muted">우리 반 순위</div>
              <div className="mt-1.5 text-[26px] font-bold text-coral">
                {rank === null ? "—" : `${rank}위`}
              </div>
            </Card>
          </div>

          {/* 이어서 쓰기 — /write 가 가장 최근 초고를 연다 */}
          <Link href="/write" className="block">
            <Card raised className="flex items-center gap-3">
              <div
                className={`h-12 w-12 flex-none rounded-[10px] ${COVER.green}`}
              />
              <div className="min-w-0 flex-1">
                <div className="truncate text-[15px] font-bold text-ink">
                  쓰던 독후감
                </div>
                <div className="mt-1 text-[13px] text-muted">
                  이어서 쓰러 가기 →
                </div>
              </div>
              <Chip tone="yellow">초고</Chip>
            </Card>
          </Link>

          <div>
            <h2 className="text-[17px] font-bold text-ink">이런 책은 어때?</h2>
            <p className="mt-1 text-[13px] text-muted">
              {recommend && recommend.reason_tags.length > 0
                ? `네가 읽은 '${recommend.reason_tags.join("', '")}' 태그와 이어져 있어`
                : "네 학년에 맞는 책이야. 골라서 독후감을 써 보자"}
            </p>
            <div className="mt-3 flex flex-col gap-2.5">
              {(recommend?.books ?? []).slice(0, 5).map((b) => (
                <Link key={b.id} href={`/write?book=${b.id}`} className="block">
                  <Card className="flex items-center gap-3">
                    <Cover book={b} size="h-12 w-12" />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[15px] font-bold text-ink">
                        {b.title}
                      </div>
                      <div className="mt-1 text-[13px] text-muted">
                        {b.author}
                      </div>
                    </div>
                    {b.tags[0] && <Chip tone="blue">{b.tags[0]}</Chip>}
                  </Card>
                </Link>
              ))}
              {recommend && recommend.books.length === 0 && (
                <p className="text-[14px] text-muted">
                  아직 추천할 책이 없어. 위에서 찾아볼까?
                </p>
              )}
            </div>
          </div>
        </>
      }
    </div>
  );
}
