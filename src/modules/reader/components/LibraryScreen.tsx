"use client";

import { useRef, useState } from "react";
import type { DictResponse, ReaderChapterResponse } from "@/shared/types";
import { ApiClientError } from "@/shared/api/client";
import { BottomSheet, Button, Card, Chip } from "@/shared/ui";
import { fetchChapter, fetchDictEntry } from "../api";
import type { ShelfBook } from "../schema";

/**
 * 책잇 서재. 목업 6 L386-404.
 *
 * 책 목록은 서버 컴포넌트가 넘긴다 (app/(main)/library/page.tsx → listShelf).
 * 본문은 장마다 GET /api/reader/:bookId?chapter= 로 불러온다.
 *
 * 본문은 18px / line-height 2 (CLAUDE.md §8).
 * 낱말을 누르면 뜻이 뜬다 — 768px 미만은 바텀시트, 이상은 우측 사이드 패널 (CLAUDE.md §8).
 *
 * 사전은 GET /api/dict 를 쓴다. 조사가 붙은 낱말도 서버가 어간을 잘라
 * 찾아 준다 — "제비가" 를 눌러도 "제비" 의 뜻이 뜬다.
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
  | { state: "found"; word: string; data: DictResponse }
  | { state: "missing"; word: string; message: string };

/** 펼쳐 둔 책과 그 장의 본문 상태. */
type Reading = {
  book: ShelfBook;
  chapterNo: number;
} & (
  | { state: "loading" }
  | { state: "ready"; chapter: ReaderChapterResponse }
  | { state: "failed"; message: string }
);

export function LibraryScreen({ books }: { books: ShelfBook[] }) {
  const [reading, setReading] = useState<Reading | null>(null);
  const [entry, setEntry] = useState<Entry>({ state: "idle" });

  // 장을 빠르게 넘기면 늦게 온 이전 장 응답이 새 장을 덮어쓴다. 마지막 요청만 반영한다.
  const chapterRequest = useRef(0);
  const dictRequest = useRef(0);

  const openChapter = async (book: ShelfBook, chapterNo: number) => {
    const requestId = ++chapterRequest.current;
    dictRequest.current++;
    setEntry({ state: "idle" });
    setReading({ book, chapterNo, state: "loading" });
    window.scrollTo({ top: 0 });

    try {
      const chapter = await fetchChapter(book.id, chapterNo);
      if (requestId !== chapterRequest.current) return;
      setReading({ book, chapterNo, state: "ready", chapter });
    } catch (error) {
      if (requestId !== chapterRequest.current) return;
      setReading({ book, chapterNo, state: "failed", message: messageOf(error) });
    }
  };

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
                  onClick={() => openChapter(book, chapterNo)}
                >
                  다시 펼치기
                </Button>
              </div>
            )}

            {reading.state === "ready" && (
              <>
                <div className="flex flex-col gap-5">
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
                <p className="mt-6 text-xs text-faint">
                  모르는 단어를 누르면 뜻이 떠요 ✎
                </p>
              </>
            )}

            {(hasPrev || hasNext) && reading.state !== "loading" && (
              <div className="mt-6 flex gap-3">
                {hasPrev && (
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={() => openChapter(book, chapterNo - 1)}
                  >
                    ← 앞 장
                  </Button>
                )}
                {hasNext && (
                  <Button
                    className="flex-1"
                    onClick={() => openChapter(book, chapterNo + 1)}
                  >
                    다음 장 →
                  </Button>
                )}
              </div>
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
                    <p className="mt-2 text-[13px] leading-relaxed text-ink-warm">
                      {entry.data.definition}
                    </p>
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
                <p className="mt-2.5 text-[15px] leading-relaxed text-ink-warm">
                  {entry.data.definition}
                </p>
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
