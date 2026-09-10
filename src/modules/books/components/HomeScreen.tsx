"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { Book } from "@/shared/types";
import { Card, Chip } from "@/shared/ui";
import { BOOKS, COVER, searchBooks, type DemoBook } from "../mock";

/**
 * 홈. 목업 6 L127-140 (인사·검색), 목업 4 (책갈피·스트릭 카드).
 * ⚠️ 목 데이터로 도는 화면이다.
 */
export function HomeScreen() {
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<Book[]>([]);

  // 300ms 디바운스 검색
  useEffect(() => {
    const t = setTimeout(() => {
      searchBooks(q).then((r) => setHits(r.books));
    }, 300);
    return () => clearTimeout(t);
  }, [q]);

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-[26px] leading-tight font-bold text-ink">
          오늘도 책갈피 모으러 가볼까?
        </h1>
        <p className="mt-2 text-[13px] text-muted">
          7일째 연속으로 오고 있어요 🔥
        </p>
      </div>

      {/* 검색 — 입력하면 목 결과가 걸러진다 */}
      <div className="relative">
        <div className="flex items-center gap-2 rounded-xl border-[1.5px] border-coral bg-card px-3.5 py-3">
          <span className="text-faint">⌕</span>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="읽고 싶은 책을 찾아봐"
            className="min-w-0 flex-1 bg-transparent text-sm text-ink outline-none placeholder:text-faint"
          />
        </div>
        {hits.length > 0 && (
          <ul className="absolute inset-x-0 z-10 mt-2 overflow-hidden rounded-xl bg-card shadow-card">
            {hits.map((b) => (
              <li
                key={b.id}
                className="flex items-center gap-3 border-b border-border-soft px-4 py-3 last:border-b-0"
              >
                <div
                  className={`h-8 w-8 flex-none rounded-lg ${COVER[(b as DemoBook).cover]}`}
                />
                <span className="flex-1 truncate text-[15px] font-bold text-ink">
                  {b.title}
                </span>
                <span className="text-[13px] text-muted">{b.author}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* 책갈피 */}
      <div className="rounded-card bg-panel p-5">
        <div className="text-[13px] text-on-dark-2">모은 책갈피</div>
        <div className="mt-1.5 text-[34px] leading-none font-bold text-on-dark">
          1,240
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2.5">
        <Card>
          <div className="text-[13px] text-muted">연속 기록 🔥</div>
          <div className="mt-1.5 text-[26px] font-bold text-ink">7일</div>
        </Card>
        <Card>
          <div className="text-[13px] text-muted">우리 반 순위</div>
          <div className="mt-1.5 text-[26px] font-bold text-coral">2위</div>
        </Card>
      </div>

      {/* 이어서 쓰기 */}
      <Link href="/write" className="block">
        <Card raised className="flex items-center gap-3">
          <div className={`h-12 w-12 flex-none rounded-[10px] ${COVER.green}`} />
          <div className="min-w-0 flex-1">
            <div className="truncate text-[15px] font-bold text-ink">
              아몬드 · 쓰던 독후감
            </div>
            <div className="mt-1 text-[13px] text-muted">이어서 쓰러 가기 →</div>
          </div>
          <Chip tone="yellow">초고</Chip>
        </Card>
      </Link>

      <div>
        <h2 className="text-[17px] font-bold text-ink">이런 책은 어때?</h2>
        <p className="mt-1 text-[13px] text-muted">
          네가 읽은 &lsquo;성장&rsquo; 태그와 이어져 있어
        </p>
        <div className="mt-3 flex flex-col gap-2.5">
          {BOOKS.slice(1, 4).map((b) => (
            <Card key={b.id} className="flex items-center gap-3">
              <div className={`h-12 w-12 flex-none rounded-[10px] ${COVER[b.cover]}`} />
              <div className="min-w-0 flex-1">
                <div className="truncate text-[15px] font-bold text-ink">
                  {b.title}
                </div>
                <div className="mt-1 text-[13px] text-muted">{b.author}</div>
              </div>
              <Chip tone="blue">{b.tags[0]}</Chip>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
