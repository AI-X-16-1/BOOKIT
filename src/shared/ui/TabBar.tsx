"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "./cn";

/**
 * 하단 탭바. 저학년 개편(목업 10, 2026-09-20): 밝은 카드 배경, 92px, 이모지 아이콘 + Jua 라벨.
 * 활성은 코랄 잉크, 비활성은 회갈색에 아이콘만 흐리게. 이전: 어두운 패널 86px, 글리프.
 *
 * 768px 이상에서는 좌측 아이콘 레일로 교체된다 (목업 6 L114-124).
 * 그래서 항목 정의를 NAV_ITEMS 로 빼 뒀다 — 레일은 같은 배열을 그대로 재사용한다.
 *
 * 아이콘은 목업의 텍스트 글리프 그대로다. 실제 아이콘셋으로 교체할 때
 * 모양을 유지할 것 (docs/design-tokens.md "Icons").
 */
export const NAV_ITEMS = [
  { href: "/home", label: "홈", glyph: "🏠" },
  { href: "/write", label: "독후감", glyph: "✏️" },
  // 목업 7·8(2026-09-18 개편)이 챌린지 자리를 도감으로 바꿨다. /challenge 는 주소로는 남는다
  { href: "/collection", label: "도감", glyph: "🥚" },
  // 목업 10 순서: 홈 / 독후감 / 도감 / 서재 / 나
  { href: "/library", label: "서재", glyph: "📚" },
  { href: "/me", label: "나", glyph: "😊" },
] as const;

export function TabBar() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="주요 메뉴"
      className="fixed inset-x-0 bottom-0 z-40 flex h-[92px] items-start justify-around border-t border-border bg-card px-1.5 pt-2 md:hidden"
      style={{ paddingBottom: "calc(6px + env(safe-area-inset-bottom))" }}
    >
      {NAV_ITEMS.map((item) => {
        const active = pathname === item.href;
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex min-h-14 flex-1 flex-col items-center justify-center gap-0.5 py-1.5",
              active ? "text-coral-ink" : "text-muted",
            )}
          >
            <span aria-hidden className={cn("text-[25px] leading-none", !active && "opacity-60")}>
              {item.glyph}
            </span>
            <span className="font-display text-[14px] leading-none">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
