"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { libraryHref } from "@/modules/reader";
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
 * 책 카드는 /write?book=<id> 로 간다 — review 모듈이 그 책의 초고를 만든다.
 * 책잇 서재에 원문이 있는 책(is_public_domain)은 추천 카드에 "서재에서 바로
 * 읽기" 링크(reader 모듈의 libraryHref)도 같이 보여준다 — 조건 없이 바로 읽을
 * 수 있는 유일한 경로다 (#58). library_url 이 있는 책(국립중앙도서관에 관외이용
 * 무료 원문이 실제로 있는 책만, server/library-availability.ts 가 확인)은
 * "국립중앙도서관에서 원문 보기" 링크도 같이 보여준다 (#72). 이 확인은 검색으로
 * 새로 들어오는 책에만 돌아가고 그 책은 curated가 아니라 추천 카드엔 안 뜨므로,
 * 검색 결과 목록에도 같은 링크를 넣었다 — 서재 링크는 curated 책 전용이라 여전히
 * 추천 카드에만 있다(공간이 좁아서가 아니라 애초에 검색 결과에는 뜰 일이 없다).
 * "쓰던 독후감" 카드는 초고가 실제로 있을 때만 그린다 — 초고 여부는 서버 컴포넌트
 * (app/(main)/home/page.tsx)가 review 모듈에 물어 draft 로 내려준다. 예전에는 카드를
 * 늘 그려서, 쓰던 글이 없는 학생에게도 뜨고 누르면 /write 로 넘어갔다.
 */

const TONES: CoverTone[] = ["green", "coral", "blue", "yellow"];

/** 표지를 그리는 데 필요한 것만. 쓰던 독후감 카드는 책 전체를 받지 않는다 */
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
        className={`${size} flex-none rounded-[10px] object-cover`}
      />
    );
  }
  return (
    <div className={`${size} flex-none rounded-[10px] ${coverClass(book)}`} />
  );
}

/** 쓰던 독후감 카드에 필요한 것. null 이면 카드를 그리지 않는다 */
export interface HomeDraft {
  id: string;
  title: string;
  cover_url: string | null;
}

export function HomeScreen({ draft }: { draft?: HomeDraft | null }) {
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
                  {/* 검색으로 새로 들어온 책만 국립중앙도서관 확인이 돈다(server/search.ts) —
                      추천 카드(curated 전용)에는 뜨지 않는 책이라 여기 별도로 보여준다 (#72) */}
                  {b.library_url && (
                    <a
                      href={b.library_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex min-h-12 items-center px-4 pb-3 text-[13px] font-bold text-coral"
                    >
                      국립중앙도서관에서 원문 보기 (외부 사이트, PC·뷰어 설치 필요) ↗
                    </a>
                  )}
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

          {/* 쓰던 독후감 — 초고가 있을 때만. /write 가 그 초고를 연다 */}
          {draft && (
            <Link href="/write" className="block">
              <Card raised className="flex items-center gap-3">
                <Cover book={draft} size="h-12 w-12" />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[15px] font-bold text-ink">
                    {draft.title}
                  </div>
                  <div className="mt-1 text-[13px] text-muted">
                    이어서 쓰러 가기 →
                  </div>
                </div>
                <Chip tone="yellow">초고</Chip>
              </Card>
            </Link>
          )}

          <div>
            <h2 className="text-[17px] font-bold text-ink">이런 책은 어때?</h2>
            <p className="mt-1 text-[13px] text-muted">
              {recommend && recommend.reason_tags.length > 0
                ? `네가 읽은 '${recommend.reason_tags.join("', '")}' 태그와 이어져 있어`
                : "네 학년에 맞는 책이야. 골라서 독후감을 써 보자"}
            </p>
            <div className="mt-3 flex flex-col gap-2.5">
              {(recommend?.books ?? []).slice(0, 5).map((b) => (
                <Card key={b.id} className="flex flex-col gap-2.5">
                  <Link
                    href={`/write?book=${b.id}`}
                    className="flex items-center gap-3"
                  >
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
                  </Link>
                  {/* 책잇 서재에 원문이 있는 책만 — 조건 없이 바로 읽을 수 있는 유일한 경로 (#58) */}
                  {b.is_public_domain && (
                    <Link
                      href={libraryHref(b.id)}
                      className="flex min-h-12 items-center text-[13px] font-bold text-coral"
                    >
                      서재에서 바로 읽기 →
                    </Link>
                  )}
                  {/* 관외이용 무료 원문이 실제로 있는 책만 — 없는데 뜨면 설치 안내만 보고
                      막힌다 (#72). 새 창으로 연다: 뷰어 설치가 필요할 수 있어서다. */}
                  {b.library_url && (
                    <a
                      href={b.library_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex min-h-12 items-center text-[13px] font-bold text-coral"
                    >
                      국립중앙도서관에서 원문 보기 (외부 사이트, PC·뷰어 설치 필요) ↗
                    </a>
                  )}
                </Card>
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
