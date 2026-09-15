"use client";

import { useSyncExternalStore } from "react";

/**
 * 서재 목록을 쪽으로 나눠 넘긴다. owner: 강민구
 *
 * 한 쪽 권수는 화면 폭이 정한다 — 768px 이상(태블릿·PC) 12권, 미만(폰) 6권.
 * 태블릿에서 긴 목록을 끝없이 내리지 않고 번호로 넘기게 하려는 것이다.
 *
 * 본문 쪽수("3 / 12쪽", PagedText)와 헷갈리지 않게 스크린리더에는 "서재 목록 N쪽"으로 읽힌다.
 * src/shared/ui 는 김민경 소유라 공용 컴포넌트로 올리지 않고 여기 둔다.
 */

const WIDE_QUERY = "(min-width: 768px)";

function subscribe(onChange: () => void) {
  const query = window.matchMedia(WIDE_QUERY);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

/**
 * 서버에서는 폭을 모르니 폰 기준(6권)으로 그리고, 브라우저에서 폭을 읽어 맞춘다.
 * useSyncExternalStore 가 하이드레이션 때는 서버 값을 쓰므로 불일치 경고가 나지 않는다.
 */
export function useShelfPageSize(): number {
  const wide = useSyncExternalStore(
    subscribe,
    () => window.matchMedia(WIDE_QUERY).matches,
    () => false,
  );
  return wide ? 12 : 6;
}

/** 처음·끝·현재 주변만 보인다 — 1 … 4 5 [6] 7 8 … 20 */
export function pageNumbers(page: number, pageCount: number): Array<number | "gap"> {
  const shown = new Set([1, pageCount, page - 1, page, page + 1]);
  if (page <= 3) [2, 3, 4].forEach((n) => shown.add(n));
  if (page >= pageCount - 2) [pageCount - 1, pageCount - 2, pageCount - 3].forEach((n) => shown.add(n));

  const numbers = [...shown].filter((n) => n >= 1 && n <= pageCount).sort((a, b) => a - b);
  const out: Array<number | "gap"> = [];
  numbers.forEach((n, index) => {
    if (index > 0 && n - numbers[index - 1] > 1) out.push("gap");
    out.push(n);
  });
  return out;
}

const BUTTON =
  "flex h-12 min-w-12 items-center justify-center rounded-btn border px-3 text-[15px] font-bold transition-opacity active:opacity-80 disabled:opacity-35";

export function ShelfPagination({
  page,
  pageCount,
  onChange,
}: {
  page: number;
  pageCount: number;
  onChange: (page: number) => void;
}) {
  if (pageCount <= 1) return null;

  // 쪽이 적으면 « » 는 번호와 같은 일을 하므로 뺀다
  const edges = pageCount > 5;
  const go = (next: number) => {
    if (next >= 1 && next <= pageCount && next !== page) onChange(next);
  };
  const plain = `${BUTTON} border-border-strong bg-card text-ink`;

  return (
    <nav aria-label="서재 목록 쪽" className="mt-4 flex flex-wrap items-center justify-center gap-1.5">
      {edges && (
        <button type="button" className={plain} onClick={() => go(1)} disabled={page === 1} aria-label="서재 목록 첫 쪽">
          «
        </button>
      )}
      <button type="button" className={plain} onClick={() => go(page - 1)} disabled={page === 1} aria-label="서재 목록 앞쪽">
        ‹
      </button>

      {pageNumbers(page, pageCount).map((n, index) =>
        n === "gap" ? (
          <span key={`gap-${index}`} className="px-0.5 text-muted" aria-hidden="true">
            …
          </span>
        ) : (
          <button
            key={n}
            type="button"
            onClick={() => go(n)}
            aria-label={`서재 목록 ${n}쪽`}
            aria-current={n === page ? "page" : undefined}
            className={n === page ? `${BUTTON} border-ink bg-ink text-on-dark` : plain}
          >
            {n}
          </button>
        ),
      )}

      <button type="button" className={plain} onClick={() => go(page + 1)} disabled={page === pageCount} aria-label="서재 목록 다음 쪽">
        ›
      </button>
      {edges && (
        <button type="button" className={plain} onClick={() => go(pageCount)} disabled={page === pageCount} aria-label="서재 목록 마지막 쪽">
          »
        </button>
      )}
    </nav>
  );
}
