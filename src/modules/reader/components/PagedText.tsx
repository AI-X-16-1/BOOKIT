"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";

/**
 * 한 장의 본문을 전자책처럼 쪽으로 나눠 넘긴다. owner: 강민구
 *
 * CSS 다단(column)으로 본문을 화면 폭 한 쪽씩 흘려 놓고, 가로로 한 쪽씩 옮긴다.
 * 쪽 수를 글자 수로 미리 자르지 않는 이유: 화면 크기·글꼴 로딩에 따라 한 쪽에 들어가는
 * 양이 달라진다. 브라우저가 흘린 결과를 재는 편이 정확하다.
 *
 * 넘기는 방법 세 가지 — 버튼(48px), 옆으로 밀기, 방향키(데스크톱).
 * 첫 쪽에서 앞으로 가면 앞 장, 마지막 쪽에서 뒤로 가면 다음 장을 부모에게 맡긴다.
 *
 * 부모는 장이 바뀔 때 key 를 바꿔 이 컴포넌트를 새로 만든다 — 쪽 상태를 따로 되돌리지 않는다.
 */

/** 쪽과 쪽 사이 간격(px). 넘길 때 한 쪽 폭 + 이 간격만큼 움직인다 */
const COLUMN_GAP = 48;

/** 이만큼 옆으로 밀어야 넘긴다(px). 낱말을 누르다 손이 조금 흔들린 건 넘기지 않는다 */
const SWIPE_MIN = 48;

const NAV_BUTTON =
  "flex h-12 min-w-12 items-center justify-center rounded-btn border border-border-strong bg-card px-4 text-[15px] font-bold text-ink transition-opacity active:opacity-80 disabled:opacity-35";

export function PagedText({
  children,
  startAt,
  hasPrevChapter,
  hasNextChapter,
  onPrevChapter,
  onNextChapter,
  onReachEnd,
}: {
  /** 흘려 놓을 본문. 문단은 블록 요소로 — flex 로 감싸면 쪽 경계에서 문단이 안 쪼개진다 */
  children: ReactNode;
  /** 앞 장에서 넘어왔으면 "end" — 마지막 쪽부터 보여준다 */
  startAt: "start" | "end";
  hasPrevChapter: boolean;
  hasNextChapter: boolean;
  onPrevChapter: () => void;
  onNextChapter: () => void;
  /**
   * 이 장의 마지막 쪽에 닿았을 때 한 번. 쪽 수를 재기 전에는 부르지 않는다 —
   * 재기 전에는 쪽이 하나로 보여서 펼치자마자 끝에 닿은 것처럼 된다.
   * 짧아서 정말 한 쪽인 장은 펼친 순간이 곧 끝이라 그대로 센다.
   */
  onReachEnd?: () => void;
}) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  const [page, setPage] = useState(0);
  const [pageCount, setPageCount] = useState(1);
  /** 한 번이라도 쪽 수를 쟀는지. onReachEnd 를 너무 일찍 부르지 않기 위한 것이다 */
  const [measured, setMeasured] = useState(false);

  // 재는 동안(ResizeObserver 콜백) 최신 쪽을 읽어야 해서 상태와 따로 둔다
  const pageRef = useRef(0);
  // 첫 측정 때 어디서 시작할지. 한 번 쓰면 비운다
  const pendingStart = useRef<"start" | "end" | null>(startAt);

  const measure = useCallback(() => {
    const scroller = scrollerRef.current;
    const content = contentRef.current;
    if (!scroller || !content) return;

    const width = scroller.clientWidth;
    if (width === 0) return;

    // 한 단 = 한 쪽. 폭이 바뀔 때마다 다시 맞춘다
    content.style.columnWidth = `${width}px`;
    const count = Math.max(
      1,
      Math.round((scroller.scrollWidth + COLUMN_GAP) / (width + COLUMN_GAP)),
    );

    let next = pageRef.current;
    if (pendingStart.current) {
      next = pendingStart.current === "end" ? count - 1 : 0;
      pendingStart.current = null;
    }
    next = Math.min(next, count - 1);

    pageRef.current = next;
    setPageCount(count);
    setPage(next);
    setMeasured(true);
    scroller.scrollLeft = next * (width + COLUMN_GAP);
  }, []);

  useEffect(() => {
    const scroller = scrollerRef.current;
    if (!scroller) return;

    // 첫 배치가 끝난 다음 프레임에 잰다
    const frame = requestAnimationFrame(measure);
    const observer = new ResizeObserver(() => measure());
    observer.observe(scroller);
    // Noto Sans KR 이 늦게 오면 글자 폭이 바뀌어 쪽 수가 달라진다
    void document.fonts?.ready.then(() => measure());

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [measure]);

  const goTo = (next: number) => {
    const scroller = scrollerRef.current;
    if (!scroller) return;

    pageRef.current = next;
    setPage(next);
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    scroller.scrollTo({
      left: next * (scroller.clientWidth + COLUMN_GAP),
      behavior: reduceMotion ? "auto" : "smooth",
    });
  };

  const atStart = page === 0;
  const atEnd = page >= pageCount - 1;

  // 장이 바뀌면 부모가 key 를 바꿔 이 컴포넌트를 새로 만든다 — 그래서 장마다 한 번이다
  const reported = useRef(false);
  useEffect(() => {
    if (!measured || !atEnd || reported.current) return;
    reported.current = true;
    onReachEnd?.();
  }, [measured, atEnd, onReachEnd]);

  const prev = () => {
    if (!atStart) goTo(page - 1);
    else if (hasPrevChapter) onPrevChapter();
  };
  const next = () => {
    if (!atEnd) goTo(page + 1);
    else if (hasNextChapter) onNextChapter();
  };

  // 방향키 — 창 전체에서 받되, 글을 입력하는 중이면 건드리지 않는다
  const nav = useRef({ prev, next });
  useEffect(() => {
    nav.current = { prev, next };
  });
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey) return;
      const target = event.target as HTMLElement | null;
      if (target && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName))) {
        return;
      }
      if (event.key === "ArrowRight") {
        event.preventDefault();
        nav.current.next();
      } else if (event.key === "ArrowLeft") {
        event.preventDefault();
        nav.current.prev();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // 옆으로 밀기. 민 직후의 click 은 낱말 뜻 열기로 새지 않게 막는다
  const swipeFrom = useRef<{ x: number; y: number } | null>(null);
  const swiped = useRef(false);

  return (
    <div className="flex flex-col">
      <div
        ref={scrollerRef}
        role="region"
        aria-label="책 본문"
        className="h-[calc(100dvh-330px)] min-h-[280px] touch-pan-y overflow-hidden md:h-[calc(100dvh-256px)]"
        onPointerDown={(event) => {
          swipeFrom.current = { x: event.clientX, y: event.clientY };
          swiped.current = false;
        }}
        onPointerUp={(event) => {
          const from = swipeFrom.current;
          swipeFrom.current = null;
          if (!from) return;
          const dx = event.clientX - from.x;
          const dy = event.clientY - from.y;
          if (Math.abs(dx) < SWIPE_MIN || Math.abs(dx) <= Math.abs(dy)) return;
          swiped.current = true;
          if (dx < 0) next();
          else prev();
        }}
        onPointerCancel={() => {
          swipeFrom.current = null;
        }}
        onClickCapture={(event) => {
          if (!swiped.current) return;
          swiped.current = false;
          event.preventDefault();
          event.stopPropagation();
        }}
      >
        <div
          ref={contentRef}
          className="h-full"
          style={{ columnGap: `${COLUMN_GAP}px`, columnFill: "auto" }}
        >
          {children}
        </div>
      </div>

      <div className="mt-3 flex items-center gap-3">
        <button
          type="button"
          onClick={prev}
          disabled={atStart && !hasPrevChapter}
          className={NAV_BUTTON}
          aria-label={atStart ? "앞 장으로" : "앞쪽으로"}
        >
          {atStart && hasPrevChapter ? "← 앞 장" : "←"}
        </button>
        <div className="flex-1 text-center text-[13px] text-muted" aria-live="polite">
          {page + 1} / {pageCount}쪽
        </div>
        <button
          type="button"
          onClick={next}
          disabled={atEnd && !hasNextChapter}
          className={NAV_BUTTON}
          aria-label={atEnd ? "다음 장으로" : "다음 쪽으로"}
        >
          {atEnd && hasNextChapter ? "다음 장 →" : "→"}
        </button>
      </div>
    </div>
  );
}
