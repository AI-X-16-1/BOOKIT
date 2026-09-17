"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

import { apiGet } from "@/shared/api/client";
import type { Book, BookSearchResponse } from "@/shared/types";
import { Card, Chip } from "@/shared/ui";

/**
 * /write 에 열 책이 없을 때 뜨는 **직접 작성** 화면. 쓰던 독후감도 없고 ?book= 도 없는 경우다.
 *
 * 왜 여기서 책을 찾게 하나 (#106 결정, 2026-09-17): 이 서비스의 기본 흐름은
 * "책잇 서재나 국립중앙도서관에서 읽고 나서 쓴다" 다. 그래서 홈 추천에는 본문이 있는
 * 책만 올린다. 하지만 종이책으로 읽고 온 학생도 써야 하고, 읽을 방법이 없는 책이
 * 110권 중 89권(시드 명작 9권 포함)이다. 그 경로를 여기로 모았다.
 *
 * 홈의 검색과 같은 API 를 쓴다. 검색 자체는 books 모듈 소관이라 결과를 그대로 보여주고
 * 고른 책으로 /write?book= 에 들어간다 — 그다음은 평소와 같다.
 */
export function PickBookFirst() {
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<Book[]>([]);
  const [searching, setSearching] = useState(false);

  // 홈과 같은 300ms 디바운스. 늦게 온 이전 응답은 버린다
  useEffect(() => {
    const query = q.trim();
    let alive = true;
    const timer = setTimeout(
      () => {
        if (!query) {
          setHits([]);
          setSearching(false);
          return;
        }
        setSearching(true);
        apiGet<BookSearchResponse>(`/api/books/search?q=${encodeURIComponent(query)}`)
          .then((r) => {
            if (alive) setHits(r.books);
          })
          .catch(() => {
            if (alive) setHits([]);
          })
          .finally(() => {
            if (alive) setSearching(false);
          });
      },
      query ? 300 : 0,
    );
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [q]);

  return (
    <div className="mx-auto flex min-h-0 w-full max-w-xl flex-1 flex-col">
      <h1 className="text-[19px] font-bold text-ink">어떤 책을 읽었어?</h1>
      <p className="mt-2 text-[15px] text-muted">
        읽은 책 제목을 찾아서 바로 독후감을 쓸 수 있어.
      </p>

      <label className="mt-5 block">
        <span className="sr-only">책 제목 검색</span>
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="예: 마당을 나온 암탉"
          className="min-h-12 w-full rounded-btn border border-border bg-surface px-4 text-[16px] text-ink placeholder:text-faint"
        />
      </label>

      {q.trim().length > 0 && (
        <ul className="mt-3 space-y-2">
          {hits.map((book) => (
            <li key={book.id}>
              <Link href={`/write?book=${book.id}`} className="block">
                <Card className="flex min-h-12 items-center gap-3">
                  <span className="min-w-0 flex-1 truncate text-[15px] font-bold text-ink">
                    {book.title}
                  </span>
                  <span className="truncate text-[13px] text-muted">{book.author}</span>
                  <Chip tone="yellow">직접 작성</Chip>
                </Card>
              </Link>
            </li>
          ))}

          {hits.length === 0 && (
            <li className="px-1 py-3 text-[14px] text-muted">
              {searching ? "찾는 중이야…" : "그 책은 못 찾았어. 다른 제목으로 찾아볼까?"}
            </li>
          )}
        </ul>
      )}

      <p className="mt-6 text-[13px] text-faint">
        아직 안 읽었다면{" "}
        <Link href="/library" className="font-bold text-coral">
          책잇 서재
        </Link>
        에서 바로 읽고 쓸 수 있어.
      </p>
    </div>
  );
}
