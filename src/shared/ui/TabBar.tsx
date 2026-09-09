"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "./cn";

/**
 * 하단 탭바. 목업 4 L87-93.
 * 배경 #2B211B, 높이 86px(세이프에어리어 포함), 활성 크림 / 비활성 --nav-inactive.
 *
 * 768px 이상에서는 좌측 아이콘 레일로 교체된다 (목업 6 L114-124).
 * 그래서 항목 정의를 NAV_ITEMS 로 빼 뒀다 — 레일은 같은 배열을 그대로 재사용한다.
 *
 * 아이콘은 목업의 텍스트 글리프 그대로다. 실제 아이콘셋으로 교체할 때
 * 모양을 유지할 것 (docs/design-tokens.md "Icons").
 */
export const NAV_ITEMS = [
  { href: "/home", label: "홈", glyph: "⌂" },
  { href: "/write", label: "독후감", glyph: "✎" },
  { href: "/challenge", label: "챌린지", glyph: "◈" },
  { href: "/me", label: "나", glyph: "☺" },
  { href: "/library", label: "서재", glyph: "▤" },
] as const;

export function TabBar() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="주요 메뉴"
      className="fixed inset-x-0 bottom-0 z-40 flex h-[86px] items-center justify-around bg-panel md:hidden"
      style={{ paddingBottom: "calc(14px + env(safe-area-inset-bottom))" }}
    >
      {NAV_ITEMS.map((item) => {
        const active = pathname === item.href;
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex min-h-12 min-w-12 flex-col items-center justify-center gap-[5px]",
              active ? "text-on-dark" : "text-nav-inactive",
            )}
          >
            <span aria-hidden className="text-[21px] leading-none">
              {item.glyph}
            </span>
            <span className="text-[11px] leading-none">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
