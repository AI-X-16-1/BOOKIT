"use client";

import { useState } from "react";
import type { DictResponse } from "@/shared/types";
import { ApiClientError } from "@/shared/api/client";
import { BottomSheet, Button, Card, Chip } from "@/shared/ui";
import { fetchDictEntry } from "../api";
import { TEXTS, type DemoText } from "../mock";

/**
 * 책잇 서재. 목업 6 L386-404.
 *
 * 본문은 18px / line-height 2 (CLAUDE.md §8).
 * 낱말을 누르면 뜻이 뜬다 — 768px 미만은 바텀시트, 이상은 우측 사이드 패널 (CLAUDE.md §8).
 *
 * 사전은 실제 API 를 쓴다 (GET /api/dict). 조사가 붙은 낱말도 서버가 어간을 잘라
 * 찾아 준다 — "제비가" 를 눌러도 "제비" 의 뜻이 뜬다.
 *
 * ⚠️ 책 목록과 본문은 아직 목 데이터다. book_contents 에 시드가 들어오면
 *    GET /api/reader/:bookId 로 바꾼다 (PR #15 참고).
 */

/** 낱말과 그 사이의 공백·문장부호를 나눈다. 낱말만 누를 수 있다. */
const TOKEN_PATTERN = /([\s.,!?~"'()[\]{}·…—-]+)/;

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

/** 뜻풀이 상태. 낱말을 누른 순간부터 결과가 올 때까지를 한 값으로 다룬다. */
type Entry =
  | { state: "idle" }
  | { state: "loading"; word: string }
  | { state: "found"; word: string; data: DictResponse }
  | { state: "missing"; word: string; message: string };

export function LibraryScreen() {
  const [open, setOpen] = useState<DemoText | null>(null);
  const [entry, setEntry] = useState<Entry>({ state: "idle" });

  const tap = async (word: string) => {
    setEntry({ state: "loading", word });

    try {
      const data = await fetchDictEntry(word);
      setEntry({ state: "found", word, data });
    } catch (error) {
      // 서버 message 는 이미 아이에게 보여줄 수 있는 문장이다 (CLAUDE.md §9).
      const message =
        error instanceof ApiClientError
          ? error.message
          : "잠깐 문제가 생겼어. 다시 눌러볼까?";
      setEntry({ state: "missing", word, message });
    }
  };

  const close = () => setEntry({ state: "idle" });
  const activeWord = entry.state === "idle" ? null : entry.word;

  if (open) {
    return (
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => {
              setOpen(null);
              close();
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
            <Tappable body={open.body} active={activeWord} onTap={tap} />
            <p className="mt-6 text-xs text-faint">
              모르는 단어를 누르면 뜻이 떠요 ✎
            </p>
          </div>

          {/* 768px 이상 — 우측 사이드 패널 */}
          <aside className="hidden w-[270px] flex-none md:block">
            {entry.state === "idle" ? (
              <p className="text-xs text-faint">낱말을 누르면 여기 뜻이 떠요</p>
            ) : (
              <Card raised>
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

      <div className="flex flex-col gap-2.5">
        {TEXTS.map((text) => (
          <Card key={text.id} className="flex items-center gap-3">
            <div className="h-14 w-11 flex-none rounded-lg bg-linear-160 from-yellow to-yellow-text-2" />
            <div className="min-w-0 flex-1">
              <div className="truncate text-[15px] font-bold text-ink">
                {text.title}
              </div>
              <div className="mt-1 text-[13px] text-muted">{text.subtitle}</div>
            </div>
            <Chip tone="green">무료</Chip>
          </Card>
        ))}
      </div>

      <Button onClick={() => setOpen(TEXTS[0])}>첫 번째 책 읽기</Button>
    </div>
  );
}
