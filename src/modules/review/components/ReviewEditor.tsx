"use client";

import { useEffect, useRef, useState } from "react";
import { Button, cn } from "@/shared/ui";
import { MAX_REVIEW_CHARS, MIN_SUBMIT_CHARS } from "../schema";

/**
 * 독후감 작성 화면. 목업 2 #2 (docs/mockups/2 독후감 작성.dc.html L66-90).
 *
 * 자동 저장은 2초 디바운스 (docs/spec.md §5). 여기서는 언제 저장할지만 정하고,
 * 저장 자체는 부모가 넘긴 onAutosave 가 한다 — 제출 직전의 마지막 저장과
 * 순서가 꼬이지 않게 부모가 저장을 한 줄로 세운다.
 */
const AUTOSAVE_DELAY_MS = 2000;

type SaveState = "idle" | "saving" | "saved" | "error";

const SAVE_LABEL: Record<SaveState, string> = {
  // 저학년 개편: 머리 칩에 들어가는 짧은 말
  idle: "자동 저장",
  saving: "저장 중…",
  saved: "✓ 저장됨",
  error: "저장 안 됨",
};

export interface ReviewEditorProps {
  bookTitle: string;
  bookAuthor: string;
  /** books.cover_url — 없으면 그라데이션 자리표시자 */
  bookCoverUrl?: string | null;
  /** AI #1 글쓰기 도우미. 없으면 상자를 그리지 않는다 */
  helperQuestion?: string;
  value: string;
  onChange: (next: string) => void;
  onAutosave: (body: string) => Promise<void>;
  onSubmit: () => void;
  submitting?: boolean;
  /** 제출해서 빈틈이 생긴 뒤. 본문을 고칠 수 없다 — 빈틈 인용문이 본문과 어긋난다 */
  locked?: boolean;
  /** 제출 결과 안내나 오류. 아이가 그대로 읽는 문장이다 */
  notice?: string | null;
}

export function ReviewEditor({
  bookTitle,
  bookAuthor,
  bookCoverUrl = null,
  helperQuestion,
  value,
  onChange,
  onAutosave,
  onSubmit,
  submitting = false,
  locked = false,
  notice = null,
}: ReviewEditorProps) {
  const [save, setSave] = useState<SaveState>("idle");
  // 서버에 있는 마지막 본문. 화면을 열자마자 같은 본문을 다시 저장하지 않으려고 둔다
  const lastSaved = useRef(value);

  // 2초 디바운스 자동 저장 (docs/spec.md §5)
  useEffect(() => {
    if (locked || submitting || value === lastSaved.current) return;
    const t = setTimeout(() => {
      setSave("saving");
      onAutosave(value).then(
        () => {
          lastSaved.current = value;
          setSave("saved");
        },
        () => setSave("error"),
      );
    }, AUTOSAVE_DELAY_MS);
    return () => clearTimeout(t);
  }, [value, locked, submitting, onAutosave]);

  const lines = value.trim() ? value.trim().split(/\n+/).length : 0;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* 저학년 개편(목업 10 M05): 표지 + 제목 + 저장 칩 → "내 이야기" + 줄 수 → 공책 에디터 → 도우미 → 다 썼어요! */}
      <div className="flex items-center gap-3">
        {bookCoverUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- 외부 알라딘 URL 이 섞여 next/image 도메인 설정을 못 한다
          <img src={bookCoverUrl} alt="" className="h-14 w-[42px] flex-none rounded-[12px] object-cover" />
        ) : (
          <div className="h-14 w-[42px] flex-none rounded-[12px] bg-linear-160 from-green-light to-green" />
        )}
        <div className="min-w-0 flex-1">
          <div className="truncate font-display text-[21px] text-ink">{bookTitle}</div>
          <div className="text-[14px] font-medium text-muted">{bookAuthor}</div>
        </div>
        <span
          className={cn(
            "flex-none rounded-full px-3 py-1.5 font-display text-[15px]",
            locked
              ? "bg-blue-bg text-blue-text"
              : save === "saved"
                ? "bg-green-bg text-green-ink"
                : save === "error"
                  ? "bg-coral-bg text-coral-ink"
                  : "bg-sunken text-muted",
          )}
        >
          {locked ? "제출했어" : SAVE_LABEL[save]}
        </span>
      </div>

      <div className="mt-4 flex items-center gap-2.5">
        <span className="font-display text-[22px] text-ink">내 이야기</span>
        <span className="rounded-full bg-yellow-bg px-3 py-1 font-display text-[16px] text-yellow-text">
          {lines === 0 ? "시작해볼까?" : value.trim().length < MIN_SUBMIT_CHARS ? `${lines}줄 · 조금만 더!` : `${lines}줄 · 좋아!`}
        </span>
      </div>

      {/* 공책 에디터 — 줄 간격 40px 에 맞춘 괘선 */}
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        readOnly={locked || submitting}
        maxLength={MAX_REVIEW_CHARS}
        placeholder="읽으면서 들었던 생각을 편하게 적어봐."
        className="mt-3 min-h-64 flex-1 resize-none rounded-[22px] border-[3px] border-border px-[18px] py-3 text-[19px] leading-[40px] text-ink-soft outline-none placeholder:text-faint focus:border-coral"
        style={{
          backgroundColor: "var(--bg-cream)",
          backgroundImage: "repeating-linear-gradient(var(--bg-cream) 0 39px, var(--bg-rule) 39px 40px)",
          backgroundAttachment: "local",
        }}
      />

      {/* 글쓰기 도우미 (AI #1) — 막히면 눌러봐 */}
      {helperQuestion && !locked && (
        <div className="mt-4 rounded-[22px] bg-sunken px-4 py-3.5">
          <div className="flex items-center gap-2.5">
            <span aria-hidden className="flex h-11 w-11 items-center justify-center rounded-full bg-coral-bg-2 text-[23px] animate-[bookit-bob-s_3.2s_ease-in-out_infinite]">🐦</span>
            <span className="font-display text-[20px] text-ink">막히면 이걸 생각해봐</span>
          </div>
          <p className="mt-2.5 rounded-[18px] border-[3px] border-coral bg-coral-bg px-3.5 py-2.5 text-[16px] font-medium leading-relaxed text-ink">
            {helperQuestion}
          </p>
        </div>
      )}

      <div className="pt-4">
        {notice && (
          <p className="mb-3 rounded-[18px] bg-yellow-bg p-3.5 text-[16px] leading-relaxed text-yellow-text-2">
            {notice}
          </p>
        )}
        {!locked && (
          <Button onClick={onSubmit} disabled={submitting || value.trim().length < MIN_SUBMIT_CHARS}>
            {submitting ? "읽어보는 중…" : "다 썼어요! →"}
          </Button>
        )}
      </div>
    </div>
  );
}
