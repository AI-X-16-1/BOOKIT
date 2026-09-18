"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { CoverPuzzle } from "@/modules/review";
import type { ReaderChapterResponse } from "@/shared/types";
import { ApiClientError } from "@/shared/api/client";
import { BottomSheet, Button, Card, Chip } from "@/shared/ui";
import { fetchChapter, fetchDictEntry, recordChapterRead } from "../api";
import type { ReaderDictResponse, ShelfBook } from "../schema";
import { PagedText } from "./PagedText";
import { ShelfPagination, useShelfPageSize } from "./ShelfPagination";

/**
 * 책잇 서재. 목업 6 L386-404.
 *
 * 책 목록은 서버 컴포넌트가 넘긴다 (app/(main)/library/page.tsx → listShelf).
 * 목록은 태블릿·PC 12권, 폰 6권씩 쪽으로 나눠 번호로 넘긴다 (ShelfPagination).
 * 본문은 장마다 GET /api/reader/:bookId?chapter= 로 불러온다.
 *
 * 본문은 18px / line-height 2 (CLAUDE.md §8). 전자책처럼 쪽을 넘기며 읽는다 (PagedText).
 * 낱말을 누르면 뜻이 뜬다 — 768px 미만은 바텀시트, 이상은 우측 사이드 패널 (CLAUDE.md §8).
 *
 * 사전은 GET /api/dict 를 쓴다. 조사가 붙은 낱말도 서버가 어간을 잘라
 * 찾아 준다 — "제비가" 를 눌러도 "제비" 의 뜻이 뜬다.
 * 사전은 문맥을 모르므로 뜻이 여럿이면 모두 보여주고 아이가 고른다 (#43).
 */

/** 낱말과 그 사이의 공백·문장부호를 나눈다. 낱말만 누를 수 있다. */
const TOKEN_PATTERN = /([\s.,!?~"'()[\]{}·…—-]+)/;

/** 본문은 빈 줄로 문단을 나눈다 (supabase/seed.sql 의 위키문헌 원문). */
const PARAGRAPH_BREAK = /\n\s*\n/;

const FALLBACK_MESSAGE = "잠깐 문제가 생겼어. 다시 해볼까?";

function Tappable({
  body,
  active,
  onTap,
}: {
  body: string;
  /** 지금 뜻을 보고 있는 낱말. 본문에서 그 낱말만 표시한다 */
  active: string | null;
  onTap: (word: string) => void;
}) {
  const parts = body.split(TOKEN_PATTERN);

  return (
    <p className="text-[18px] leading-[2] text-ink-soft">
      {parts.map((part, index) => {
        // 구분자이거나 빈 조각은 그대로 둔다
        if (!part || TOKEN_PATTERN.test(part)) {
          return <span key={index}>{part}</span>;
        }

        // 모든 낱말이 눌린다. 전부에 밑줄을 그으면 본문이 읽히지 않으므로
        // 지금 보고 있는 낱말만 표시한다.
        return (
          <button
            key={index}
            type="button"
            onClick={() => onTap(part)}
            className={
              part === active
                ? "border-b-2 border-b-coral text-coral-deep"
                : "hover:text-coral-deep"
            }
          >
            {part}
          </button>
        );
      })}
    </p>
  );
}

/**
 * 낱말의 뜻. 하나면 문장 하나, 여럿이면 번호를 붙여 모두 보여준다.
 *
 * 뜻이 여럿일 때 첫 뜻만 보여주면, 본문과 다른 뜻을 정답처럼 믿게 된다
 * ("쓰입니다" 에 '글자가 적히다' 만 뜨는 식). 고르는 일을 아이에게 맡긴다.
 */
function Senses({
  data,
  size,
}: {
  data: ReaderDictResponse;
  size: "panel" | "sheet";
}) {
  // 배포 순서가 어긋나 senses 없는 응답이 와도 화면은 그린다.
  const senses = data.senses?.length ? data.senses : [{ definition: data.definition }];
  const text = size === "sheet" ? "text-[15px]" : "text-[13px]";

  if (senses.length === 1) {
    return (
      <p className={`${size === "sheet" ? "mt-2.5" : "mt-2"} ${text} leading-relaxed text-ink-warm`}>
        {senses[0].definition}
      </p>
    );
  }

  return (
    <>
      <p className={`${size === "sheet" ? "mt-2.5 text-[13px]" : "mt-2 text-[11px]"} text-muted`}>
        뜻이 여러 개야. 글에 맞는 뜻을 찾아봐
      </p>
      <ol className="mt-2 flex flex-col gap-2">
        {senses.map((sense, index) => (
          <li key={index} className={`flex gap-2 ${text} leading-relaxed text-ink-warm`}>
            <span className="flex-none font-bold text-coral-deep">{index + 1}</span>
            <span>{sense.definition}</span>
          </li>
        ))}
      </ol>
    </>
  );
}

/** 1~6 → 초N, 7~9 → 중N. 범위가 같은 학교 안이면 "초1~2", 걸치면 "초6~중1". */
function gradeLabel(min: number | null, max: number | null): string | null {
  if (min === null) return null;

  const label = (grade: number) => (grade <= 6 ? `초${grade}` : `중${grade - 6}`);
  if (max === null || max === min) return label(min);
  if (min <= 6 === max <= 6) return `${label(min)}~${max <= 6 ? max : max - 6}`;
  return `${label(min)}~${label(max)}`;
}

/**
 * 내 학년 기준으로 책을 세 묶음으로 나눈다.
 *
 * 0 = 내 학년에 맞는 책 · 1 = 더 쉬운 책 · 2 = 더 어려운 책.
 * 막지는 않는다 — 읽고 싶으면 읽으면 된다. 위로 넘보는 건 독서에서 자연스럽다.
 * 다만 기본 화면에서는 내 학년 책이 먼저 보여야 한다. 서재가 29권이라
 * 학년이 섞여 있으면 초1 이 중3 소설만 보게 된다.
 */
function gradeBucket(book: ShelfBook, myGrade: number | null): 0 | 1 | 2 {
  if (myGrade === null || book.gradeMin === null) return 0;
  if (book.gradeMin > myGrade) return 2;
  if (book.gradeMax !== null && book.gradeMax < myGrade) return 1;
  return 0;
}

/**
 * 학년대 필터. 44권이 되면서 폰에서 6권씩 8쪽이라, 심사위원이 "중3이 읽을 책" 을
 * 보려면 여러 쪽을 넘겨야 했다. 이미 있는 target_grade_min/max 로 거른다 —
 * 장르 태그(GENRE_TAGS)에 학년을 섞으면 도장판이 모르는 장르를 받는다 (#115).
 */
const BANDS = [
  { key: "all", label: "전체", has: () => true },
  { key: "low", label: "초1~3", has: (b: ShelfBook) => inBand(b, 1, 3) },
  { key: "mid", label: "초4~6", has: (b: ShelfBook) => inBand(b, 4, 6) },
  { key: "high", label: "중1~3", has: (b: ShelfBook) => inBand(b, 7, 9) },
] as const;

type BandKey = (typeof BANDS)[number]["key"];

/** 책의 학년 범위가 이 구간과 겹치면 포함한다 — 초5~중1 책은 두 구간에 다 뜬다 */
function inBand(book: ShelfBook, from: number, to: number): boolean {
  const min = book.gradeMin ?? 1;
  const max = book.gradeMax ?? 9;
  return min <= to && max >= from;
}

function subtitleOf(book: ShelfBook): string {
  const grade = gradeLabel(book.gradeMin, book.gradeMax);
  return grade ? `${book.author} · ${grade}` : book.author;
}

function messageOf(error: unknown): string {
  // 서버 message 는 이미 아이에게 보여줄 수 있는 문장이다 (CLAUDE.md §9).
  return error instanceof ApiClientError ? error.message : FALLBACK_MESSAGE;
}

/** 뜻풀이 상태. 낱말을 누른 순간부터 결과가 올 때까지를 한 값으로 다룬다. */
type Entry =
  | { state: "idle" }
  | { state: "loading"; word: string }
  | { state: "found"; word: string; data: ReaderDictResponse }
  | { state: "missing"; word: string; message: string };

/** 펼쳐 둔 책과 그 장의 본문 상태. */
type Reading = {
  book: ShelfBook;
  chapterNo: number;
  /** 앞 장에서 거꾸로 넘어왔으면 "end" — 그 장의 마지막 쪽부터 연다 */
  startAt: "start" | "end";
} & (
  | { state: "loading" }
  | { state: "ready"; chapter: ReaderChapterResponse }
  | { state: "failed"; message: string }
);

export function LibraryScreen({
  books,
  initial,
  myGrade = null,
  readChapters = {},
}: {
  books: ShelfBook[];
  /** /library?book=<id>&chapter=<n> 로 들어왔을 때 바로 펼칠 책 (libraryHref) */
  initial?: { bookId: string; chapterNo: number };
  /** 로그인한 학생의 학년. 교사이거나 모르면 null — 그때는 원래 순서 그대로다 */
  myGrade?: number | null;
  /**
   * 책 id → 읽은 장 수. 표지 퍼즐을 그리는 데 쓴다 (sprint-0918 ①).
   * 서버 컴포넌트가 채운다 (review 의 loadPuzzleCounts). 없는 책은 퍼즐을 안 그린다 —
   * 한 장도 안 읽은 책에 잠긴 조각만 9개 보여줄 이유가 없다.
   */
  readChapters?: Record<string, number>;
}) {
  // 주소로 책을 짚고 들어오면 목록을 거치지 않고 그 장을 바로 펼친다.
  // 서재에 없는 책이면 조용히 목록을 보여준다.
  const initialBook = initial && books.find((book) => book.id === initial.bookId);
  const initialChapterNo =
    initial && initialBook
      ? Math.min(Math.max(initial.chapterNo, 1), initialBook.chapterCount)
      : 1;

  const [reading, setReading] = useState<Reading | null>(() =>
    initialBook
      ? { book: initialBook, chapterNo: initialChapterNo, startAt: "start", state: "loading" }
      : null,
  );
  const [entry, setEntry] = useState<Entry>({ state: "idle" });

  // 목록 쪽. 책을 읽다 돌아와도 보던 쪽이 남는다
  const [shelfPage, setShelfPage] = useState(1);
  const [band, setBand] = useState<BandKey>("all");
  const pageSize = useShelfPageSize();

  // 장을 빠르게 넘기면 늦게 온 이전 장 응답이 새 장을 덮어쓴다. 마지막 요청만 반영한다.
  const chapterRequest = useRef(0);

  /**
   * 장 끝에 닿으면 읽었다고 적는다 (POST /api/reading/progress, sprint-0918 ①).
   *
   * 표지 퍼즐 조각과 캐릭터 알·부화가 여기서 나온다. 읽는 흐름을 막을 것은 아니라
   * 실패는 조용히 넘긴다 — 다시 그 장에 닿으면 또 보내고, 서버가 중복을 무시한다.
   *
   * 처음 적은 장일 때만 화면을 새로 고친다. 퍼즐은 서버 컴포넌트가 넘긴 값으로
   * 그려서(#140), 새로고침 없이는 읽는 중에 조각이 열리지 않는다. 이미 적힌 장에는
   * 바뀔 것이 없으니 부르지 않는다 — 읽는 중에 서재를 다시 불러올 이유가 없다.
   */
  const router = useRouter();
  const recorded = useRef(new Set<string>());
  const markChapterRead = (bookId: string, chapterNo: number) => {
    const key = `${bookId}:${chapterNo}`;
    if (recorded.current.has(key)) return;
    recorded.current.add(key);

    void recordChapterRead(bookId, chapterNo)
      .then(() => router.refresh())
      .catch(() => {
        // 다음에 다시 닿으면 또 보낸다
        recorded.current.delete(key);
      });
  };
  const dictRequest = useRef(0);

  const loadChapter = async (
    book: ShelfBook,
    chapterNo: number,
    startAt: Reading["startAt"],
    requestId: number,
  ) => {
    try {
      const chapter = await fetchChapter(book.id, chapterNo);
      if (requestId !== chapterRequest.current) return;
      setReading({ book, chapterNo, startAt, state: "ready", chapter });
    } catch (error) {
      if (requestId !== chapterRequest.current) return;
      setReading({ book, chapterNo, startAt, state: "failed", message: messageOf(error) });
    }
  };

  const openChapter = (
    book: ShelfBook,
    chapterNo: number,
    startAt: Reading["startAt"] = "start",
  ) => {
    const requestId = ++chapterRequest.current;
    dictRequest.current++;
    setEntry({ state: "idle" });
    setReading({ book, chapterNo, startAt, state: "loading" });
    window.scrollTo({ top: 0 });
    void loadChapter(book, chapterNo, startAt, requestId);
  };

  // 주소로 짚은 책의 본문. 화면 상태는 useState 초기값이 이미 loading 으로 잡았다.
  useEffect(() => {
    if (!initialBook) return;
    void loadChapter(initialBook, initialChapterNo, "start", ++chapterRequest.current);
    // 마운트 때 한 번만 — 이후 장 이동은 openChapter 가 맡는다
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const tap = async (word: string) => {
    const requestId = ++dictRequest.current;
    setEntry({ state: "loading", word });

    try {
      const data = await fetchDictEntry(word);
      if (requestId !== dictRequest.current) return;
      setEntry({ state: "found", word, data });
    } catch (error) {
      if (requestId !== dictRequest.current) return;
      setEntry({ state: "missing", word, message: messageOf(error) });
    }
  };

  const close = () => {
    dictRequest.current++;
    setEntry({ state: "idle" });
  };
  const activeWord = entry.state === "idle" ? null : entry.word;

  if (reading) {
    const { book, chapterNo } = reading;
    const hasPrev = chapterNo > 1;
    const hasNext = chapterNo < book.chapterCount;

    return (
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => {
              chapterRequest.current++;
              setReading(null);
              close();
              // ?book= 으로 들어왔다면 주소를 목록으로 돌린다 — 새로고침에 그 책이 다시 열리지 않게
              window.history.replaceState(null, "", "/library");
            }}
            className="flex h-12 w-12 flex-none items-center justify-center text-muted"
            aria-label="서재로 돌아가기"
          >
            ←
          </button>
          <div className="min-w-0 flex-1">
            <div className="truncate text-[15px] font-bold text-ink">
              {book.title}
            </div>
            <div className="text-xs text-muted">{subtitleOf(book)}</div>
          </div>
          {book.chapterCount > 1 && (
            <Chip tone="yellow">
              {chapterNo} / {book.chapterCount}장
            </Chip>
          )}
          {/* 서재 책은 DB 행이 있어 바로 독후감으로 이어진다 — /write?book= 이 초고를 만든다 */}
          <Link
            href={`/write?book=${book.id}`}
            className="flex h-12 flex-none items-center rounded-btn bg-ink px-4 text-[15px] font-bold text-on-dark"
          >
            독후감 쓰기
          </Link>
        </div>

        <div className="mt-4 flex min-h-0 flex-1 gap-6">
          <div className="min-w-0 flex-1 rounded-card bg-notebook p-5">
            {reading.state === "loading" && (
              <p className="text-[16px] text-muted">책을 펼치는 중…</p>
            )}

            {reading.state === "failed" && (
              <div className="flex flex-col items-start gap-4">
                <p className="text-[16px] leading-relaxed text-muted">
                  {reading.message}
                </p>
                <Button
                  variant="outline"
                  onClick={() => openChapter(book, chapterNo, reading.startAt)}
                >
                  다시 펼치기
                </Button>
              </div>
            )}

            {reading.state === "ready" && (
              <>
                <PagedText
                  // 장이 바뀌면 쪽 상태를 새로 만든다
                  key={`${book.id}:${chapterNo}`}
                  startAt={reading.startAt}
                  hasPrevChapter={hasPrev}
                  hasNextChapter={hasNext}
                  onPrevChapter={() => openChapter(book, chapterNo - 1, "end")}
                  onNextChapter={() => openChapter(book, chapterNo + 1, "start")}
                  onReachEnd={() => markChapterRead(book.id, chapterNo)}
                >
                  {/* 문단은 블록으로 쌓는다 — flex 로 감싸면 쪽 경계에서 문단이 쪼개지지 않는다 */}
                  <div className="space-y-5">
                    {reading.chapter.body
                      .split(PARAGRAPH_BREAK)
                      .map((paragraph) => paragraph.trim())
                      .filter(Boolean)
                      .map((paragraph, index) => (
                        <Tappable
                          key={index}
                          body={paragraph}
                          active={activeWord}
                          onTap={tap}
                        />
                      ))}
                  </div>

                  {!hasNext && (
                    <Link
                      href={`/write?book=${book.id}`}
                      className="mt-6 block min-h-12 rounded-btn bg-coral px-5 py-[19px] text-center text-[17px] font-bold text-white [break-inside:avoid]"
                    >
                      다 읽었어! 독후감 쓰러 가기 →
                    </Link>
                  )}
                </PagedText>
                <p className="mt-2 text-center text-xs text-faint">
                  모르는 단어를 누르면 뜻이 떠요 ✎ · 옆으로 밀어서 넘겨
                </p>
              </>
            )}
          </div>

          {/* 768px 이상 — 우측 사이드 패널 */}
          <aside className="hidden w-[270px] flex-none md:block">
            {/* 표지 퍼즐 — 목업 7 #4 · 목업 8 #5 (sprint-0918 ①, 박재경).
                사전 패널 위에 둔다. 사전이 뜨면 뜻이 우선이라 접는다 */}
            {entry.state === "idle" && readChapters[book.id] !== undefined && (
              <div className="mb-4">
                <div className="mb-2 text-[13px] font-bold text-ink">
                  읽을수록 표지가 드러나요
                </div>
                <CoverPuzzle
                  coverUrl={null}
                  readChapters={readChapters[book.id]}
                  totalChapters={book.chapterCount}
                />
              </div>
            )}

            {entry.state === "idle" ? (
              <p className="text-xs text-faint">낱말을 누르면 여기 뜻이 떠요</p>
            ) : (
              <Card raised className="sticky top-4">
                <div className="flex items-start justify-between gap-2">
                  <span className="text-base font-bold text-ink">
                    {entry.state === "found" ? entry.data.word : entry.word}
                  </span>
                  <button
                    type="button"
                    onClick={close}
                    className="text-[13px] text-faint"
                    aria-label="닫기"
                  >
                    ✕
                  </button>
                </div>

                {entry.state === "loading" && (
                  <p className="mt-2 text-[13px] text-muted">찾는 중…</p>
                )}
                {entry.state === "missing" && (
                  <p className="mt-2 text-[13px] leading-relaxed text-muted">
                    {entry.message}
                  </p>
                )}
                {entry.state === "found" && (
                  <>
                    <Senses data={entry.data} size="panel" />
                    <p className="mt-3 text-[11px] text-on-dark-2">
                      {entry.data.source}
                    </p>
                  </>
                )}
              </Card>
            )}
          </aside>
        </div>

        {/* 768px 미만 — 바텀시트 */}
        <div className="md:hidden">
          <BottomSheet
            open={entry.state !== "idle"}
            onClose={close}
            label="낱말 뜻"
          >
            <div className="text-xl font-bold text-ink">
              {entry.state === "found" ? entry.data.word : activeWord}
            </div>
            {entry.state === "loading" && (
              <p className="mt-2.5 text-[15px] text-muted">찾는 중…</p>
            )}
            {entry.state === "missing" && (
              <p className="mt-2.5 text-[15px] leading-relaxed text-muted">
                {entry.message}
              </p>
            )}
            {entry.state === "found" && (
              <>
                <Senses data={entry.data} size="sheet" />
                <p className="mt-4 text-xs text-faint">{entry.data.source}</p>
              </>
            )}
          </BottomSheet>
        </div>
      </div>
    );
  }

  // 폭이 바뀌어 쪽 수가 줄면 마지막 쪽으로 맞춘다
  // 내 학년 책 → 쉬운 책 → 어려운 책. 같은 묶음 안에서는 서버가 준 순서(학년·제목)를 지킨다
  const picked = books.filter(BANDS.find((b) => b.key === band)?.has ?? (() => true));
  const sorted =
    myGrade === null
      ? picked
      : [...picked].sort((a, b) => gradeBucket(a, myGrade) - gradeBucket(b, myGrade));

  const pageCount = Math.max(1, Math.ceil(sorted.length / pageSize));
  const currentPage = Math.min(shelfPage, pageCount);
  const pageBooks = sorted.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-[22px] font-bold text-ink">책잇 서재</h1>
        <p className="mt-1.5 text-[13px] text-muted">
          저작권이 풀린 책은 여기서 바로 읽을 수 있어
        </p>
      </div>

      {books.length === 0 ? (
        <Card>
          <p className="text-[15px] text-muted">
            아직 서재에 꽂힌 책이 없어. 곧 채워 둘게!
          </p>
        </Card>
      ) : (
        <div>
          {/* 학년대 칩. 누르면 첫 쪽으로 돌아간다 — 3쪽을 보다 필터를 바꾸면 빈 쪽이 뜬다 */}
          <div className="mb-3 flex flex-wrap gap-2">
            {BANDS.map((b) => {
              const count = books.filter(b.has).length;
              const on = band === b.key;
              return (
                <button
                  key={b.key}
                  type="button"
                  aria-pressed={on}
                  onClick={() => {
                    setBand(b.key);
                    setShelfPage(1);
                  }}
                  className={`flex min-h-12 items-center rounded-full px-4 text-[14px] font-bold ${
                    on ? "bg-ink text-on-dark" : "bg-card text-muted"
                  }`}
                >
                  {b.label} {count}
                </button>
              );
            })}
          </div>

          {/* 폰 1열 · 태블릿 2열 · 넓은 PC 3열. 태블릿은 왼쪽 레일이 자리를 차지해 3열이면 제목이 잘린다 */}
          <div className="grid gap-2.5 md:grid-cols-2 xl:grid-cols-3">
            {pageBooks.map((book) => (
              <button
                key={book.id}
                type="button"
                onClick={() => openChapter(book, 1)}
                className="text-left"
              >
                <Card className="flex h-full items-center gap-3">
                  <div className="h-14 w-11 flex-none rounded-lg bg-linear-160 from-yellow to-yellow-text-2" />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[15px] font-bold text-ink">
                      {book.title}
                    </div>
                    <div className="mt-1 text-[13px] text-muted">
                      {subtitleOf(book)}
                    </div>
                  </div>
                  {gradeBucket(book, myGrade) === 2 ? (
                    <Chip tone="yellow">조금 어려워</Chip>
                  ) : (
                    <Chip tone="green">무료</Chip>
                  )}
                </Card>
              </button>
            ))}
            {/* 마지막 쪽처럼 책이 pageSize 보다 적으면 빈 칸을 같은 높이로 채운다.
                안 그러면 쪽을 넘길 때 번호 버튼이 위로 튀어 올라온다 (CLS). 보이지 않고 눌리지도 않는다 */}
            {Array.from({ length: Math.max(0, pageSize - pageBooks.length) }).map((_, i) => (
              <div key={`pad-${i}`} aria-hidden className="invisible">
                <Card className="flex items-center gap-3">
                  <div className="h-14 w-11 flex-none" />
                  <div className="min-w-0 flex-1">
                    <div className="text-[15px] font-bold">&nbsp;</div>
                    <div className="mt-1 text-[13px]">&nbsp;</div>
                  </div>
                </Card>
              </div>
            ))}
          </div>

          <ShelfPagination
            page={currentPage}
            pageCount={pageCount}
            onChange={(next) => {
              setShelfPage(next);
              window.scrollTo({ top: 0 });
            }}
          />
        </div>
      )}
    </div>
  );
}
