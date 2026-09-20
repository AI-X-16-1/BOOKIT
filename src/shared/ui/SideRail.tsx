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
      // 뷰포트 높이에 고정하고 붙여 둔다 — 페이지가 길어져도 레일이 따라 늘어나 아바타가 아래로 밀리지 않는다
      // 저학년 개편(목업 9): 116px 밝은 레일, 이모지 + Jua 라벨
      className="sticky top-0 hidden h-dvh w-[116px] flex-none flex-col items-center gap-2 self-start border-r border-border bg-card py-6 md:flex"
    >
      {/* 앱 아이콘 — 홈으로. 목업의 코랄 네모 자리표시자를 실제 아이콘으로 */}
      <Link href="/home" aria-label="책잇 홈" className="block h-13 w-13 overflow-hidden rounded-[16px]">
        {/* eslint-disable-next-line @next/next/no-img-element -- 정적 PWA 아이콘 */}
        <img src="/icons/icon-192.png" alt="" width={52} height={52} className="h-13 w-13" />
      </Link>
      <div className="h-3" />
      {NAV_ITEMS.map((item) => {
        const active = pathname === item.href;
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-label={item.label}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex h-[76px] w-[88px] flex-col items-center justify-center gap-1 rounded-[20px]",
              active ? "bg-coral-bg text-coral-ink" : "text-muted hover:bg-sunken",
            )}
          >
            <span aria-hidden className={cn("text-[28px] leading-none", !active && "opacity-60")}>{item.glyph}</span>
            <span className="font-display text-[15px] leading-none">{item.label}</span>
          </Link>
        );
      })}
      <div className="flex-1" />
      {/* 하단 아바타 — "나" 로. 이름 첫 글자는 프로필 조회가 붙기 전까지 넣지 않는다 */}
      <Link
        href="/me"
        aria-label="내 정보"
        className="flex h-12 w-12 items-center justify-center rounded-full bg-yellow text-[22px]"
      >
        <span aria-hidden>😊</span>
      </Link>
    </nav>
  );
}
