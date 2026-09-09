"use client";

import { useEffect, type ReactNode } from "react";
import { cn } from "./cn";

/**
 * 768px 미만에서 쓰는 바텀시트. 목업 2 L36-58 (책 열기 · 외부 도서관 이동).
 * 상단 모서리 26px, 44×5 드래그 핸들, 우상단 ✕.
 *
 * 768px 이상에서는 같은 내용이 사이드 패널로 간다 (CLAUDE.md §8).
 * 그 분기는 이 컴포넌트가 아니라 부르는 쪽에서 한다.
 *
 * 외부 라이브러리를 쓰지 않는다 — 백드롭 클릭, Escape, 스크롤 잠금만 직접 처리.
 */
export interface BottomSheetProps {
  open: boolean;
  onClose: () => void;
  /** 스크린리더용 제목. 시각적 제목은 children 안에서 직접 배치한다. */
  label: string;
  children: ReactNode;
  className?: string;
}

export function BottomSheet({
  open,
  onClose,
  label,
  children,
  className,
}: BottomSheetProps) {
  useEffect(() => {
    if (!open) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end">
      <button
        type="button"
        aria-label="닫기"
        onClick={onClose}
        className="absolute inset-0 bg-ink/45"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={label}
        className={cn(
          "relative max-h-[88vh] overflow-y-auto rounded-t-sheet bg-cream px-6 pt-7 pb-[34px]",
          className,
        )}
      >
        <div className="mx-auto mb-[22px] h-[5px] w-11 rounded-full bg-sheet-handle" />
        <button
          type="button"
          onClick={onClose}
          aria-label="닫기"
          className="absolute top-[26px] right-6 flex h-11 w-11 items-center justify-center text-base text-muted"
        >
          ✕
        </button>
        {children}
      </div>
    </div>
  );
}
