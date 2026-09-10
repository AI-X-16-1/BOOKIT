"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "./cn";
import { NAV_ITEMS } from "./TabBar";

/**
 * 좌측 아이콘 레일. 목업 6 L114-124.
 *
 * 768px 이상에서 하단 탭바를 대체한다 (CLAUDE.md §8).
 * 항목은 TabBar 의 NAV_ITEMS 를 그대로 재사용한다 — 두 곳에서 메뉴가 갈라지지 않게.
 */
export function SideRail() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="주요 메뉴"
      className="hidden w-[76px] flex-none flex-col items-center gap-3.5 bg-panel py-5 md:flex"
    >
      <div className="flex h-11 w-11 items-center justify-center rounded-[14px] bg-coral text-lg text-white">
        ⌄
      </div>
      <div className="h-1.5" />
      {NAV_ITEMS.map((item) => {
        const active = pathname === item.href;
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-label={item.label}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex h-11 w-11 items-center justify-center rounded-[14px] text-[19px]",
              active
                ? "bg-panel-inner text-on-dark"
                : "text-nav-inactive hover:text-on-dark-2",
            )}
          >
            <span aria-hidden>{item.glyph}</span>
          </Link>
        );
      })}
      <div className="flex-1" />
      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-yellow text-sm font-bold text-stamp-text">
        민
      </div>
    </nav>
  );
}
