"use client";

import { useEffect, useState } from "react";
import { Button } from "@/shared/ui";

/**
 * 독후감 작성 화면. 목업 2 #2 (docs/mockups/2 독후감 작성.dc.html L66-90).
 *
 * 자동 저장은 2초 디바운스 (docs/spec.md §5). 지금은 목이라 실제로 저장하지 않고
 * "초고 자동 저장됨" 표시만 갱신한다.
 */
export interface ReviewEditorProps {
  bookTitle: string;
  bookAuthor: string;
  helperQuestion: string;
  value: string;
  onChange: (next: string) => void;
  onSubmit: () => void;
  submitting?: boolean;
}

export function ReviewEditor({
  bookTitle,
  bookAuthor,
  helperQuestion,
  value,
  onChange,
  onSubmit,
  submitting = false,
}: ReviewEditorProps) {
  const [savedAt, setSavedAt] = useState<string | null>(null);

  // 2초 디바운스 자동 저장 (docs/spec.md §5)
  useEffect(() => {
    if (!value) return;
    const t = setTimeout(() => setSavedAt(new Date().toISOString()), 2000);
    return () => clearTimeout(t);
  }, [value]);

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
      <div className="mt-[18px] rounded-xl border-l-[3px] border-l-yellow bg-yellow-bg p-4">
        <div className="text-sm font-bold text-yellow-text">✎ 글쓰기 도우미</div>
        <p className="mt-1.5 text-sm leading-relaxed text-yellow-text-2">
          {helperQuestion}
        </p>
      </div>

      {/* 에디터 */}
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="읽으면서 들었던 생각을 편하게 적어봐."
        className="mt-4 min-h-64 flex-1 resize-none rounded-[14px] border border-border-soft bg-card p-5 text-[15px] leading-[2] text-ink-soft outline-none placeholder:text-faint focus:border-coral"
      />

      <div className="pt-4">
        <Button onClick={onSubmit} disabled={submitting || value.trim().length < 10}>
          {submitting ? "빈틈을 찾고 있어…" : "이해도 확인 받기"}
        </Button>
        <p className="mt-3 text-center text-[13px] text-faint">
          {savedAt ? "초고 자동 저장됨" : "쓰는 대로 자동 저장돼"}
        </p>
      </div>
    </div>
  );
}
