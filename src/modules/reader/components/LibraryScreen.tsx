"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { ReaderChapterResponse } from "@/shared/types";
import { ApiClientError } from "@/shared/api/client";
import { BottomSheet, Button, Card, Chip } from "@/shared/ui";
import { fetchChapter, fetchDictEntry } from "../api";
import type { ReaderDictResponse, ShelfBook } from "../schema";
import { PagedText } from "./PagedText";

/**
 * 책잇 서재. 목업 6 L386-404.
 *
 * 책 목록은 서버 컴포넌트가 넘긴다 (app/(main)/library/page.tsx → listShelf).
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
}: {
  books: ShelfBook[];
  /** /library?book=<id>&chapter=<n> 로 들어왔을 때 바로 펼칠 책 (libraryHref) */
  initial?: { bookId: string; chapterNo: number };
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

  // 장을 빠르게 넘기면 늦게 온 이전 장 응답이 새 장을 덮어쓴다. 마지막 요청만 반영한다.
  const chapterRequest = useRef(0);
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
        <div className="flex flex-col gap-2.5">
          {books.map((book) => (
            <button
              key={book.id}
              type="button"
              onClick={() => openChapter(book, 1)}
              className="text-left"
            >
              <Card className="flex items-center gap-3">
                <div className="h-14 w-11 flex-none rounded-lg bg-linear-160 from-yellow to-yellow-text-2" />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[15px] font-bold text-ink">
                    {book.title}
                  </div>
                  <div className="mt-1 text-[13px] text-muted">
                    {subtitleOf(book)}
                  </div>
                </div>
                <Chip tone="green">무료</Chip>
              </Card>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
