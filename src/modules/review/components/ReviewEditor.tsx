"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/shared/ui";
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
  idle: "쓰는 대로 자동 저장돼",
  saving: "저장하고 있어…",
  saved: "초고 자동 저장됨",
  error: "저장이 안 됐어. 인터넷 연결을 확인해줘",
};

export interface ReviewEditorProps {
  bookTitle: string;
  bookAuthor: string;
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

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* 헤더 — 책 표지는 알라딘 이미지가 붙기 전까지 그라데이션 자리표시자 */}
      <div className="flex items-center gap-3">
        <div className="h-9 w-9 flex-none rounded-[9px] bg-linear-160 from-green-light to-green" />
        <div className="min-w-0 flex-1">
          <div className="truncate text-[17px] font-bold text-ink">
            {bookTitle} · 독후감
          </div>
          <div className="mt-0.5 text-[13px] text-muted">{bookAuthor}</div>
        </div>
        <div className="text-[13px] text-faint">{value.length}자</div>
      </div>

      {/* 글쓰기 도우미 (AI #1) */}
      {helperQuestion && (
        <div className="mt-[18px] rounded-xl border-l-[3px] border-l-yellow bg-yellow-bg p-4">
          <div className="text-sm font-bold text-yellow-text">✎ 글쓰기 도우미</div>
          <p className="mt-1.5 text-sm leading-relaxed text-yellow-text-2">
            {helperQuestion}
          </p>
        </div>
      )}

      {/* 에디터 */}
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        readOnly={locked || submitting}
        maxLength={MAX_REVIEW_CHARS}
        placeholder="읽으면서 들었던 생각을 편하게 적어봐."
        className="mt-4 min-h-64 flex-1 resize-none rounded-[14px] border border-border-soft bg-card p-5 text-[15px] leading-[2] text-ink-soft outline-none placeholder:text-faint focus:border-coral"
      />

      <div className="pt-4">
        {notice && (
          <p className="mb-3 rounded-xl bg-yellow-bg p-3.5 text-sm leading-relaxed text-yellow-text-2">
            {notice}
          </p>
        )}
        {!locked && (
          <Button
            onClick={onSubmit}
            disabled={submitting || value.trim().length < MIN_SUBMIT_CHARS}
          >
            {submitting ? "빈틈을 찾고 있어…" : "이해도 확인 받기"}
          </Button>
        )}
        <p className="mt-3 text-center text-[13px] text-faint">
          {locked ? "제출한 독후감이야" : SAVE_LABEL[save]}
        </p>
      </div>
    </div>
  );
}
