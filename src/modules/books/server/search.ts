// src/modules/books/server/search.ts
import "server-only";

import type { Book } from "@/shared/types";
import type { BookInsertRow, BooksAdminPort } from "./db";
import { BookSourceError, type BookSource, type RawBookHit } from "./source";
import { mapToGenreTags } from "./tags";

export type SearchResult =
  | { ok: true; books: Book[] }
  | { ok: false; code: string; message: string; status: number };

type IsbnHit = RawBookHit & { isbn13: string };

/**
 * TODO: 국회전자도서관 실제 검색 딥링크 URL 패턴 확인 후 채운다.
 * docs/superpowers/specs/2026-09-14-books-search-recommend-design.md 후속 작업 참고.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars -- params kept for future implementation, see TODO above
export function buildLibraryUrl(_title: string, _isbn13: string): string | null {
  return null;
}

export function rawHitToBookInsert(hit: IsbnHit): BookInsertRow {
  return {
    isbn13: hit.isbn13,
    title: hit.title,
    author: hit.author,
    // Book.publisher는 non-null string인데 RawBookHit.publisher는 소스에 따라 null일 수
    // 있다 — 빈 문자열로 대체한다 (DB 마이그레이션은 publisher를 nullable로 뒀는데 db.ts의
    // 타입은 non-null이다; 이 불일치는 shared/ 소유자에게 확인 요청할 사항이지 여기서
    // 고치지 않는다).
    publisher: hit.publisher ?? "",
    cover_url: hit.coverUrl,
    tags: mapToGenreTags(hit.rawCategory, hit.kdc),
    target_grade_min: hit.targetGradeMin,
    target_grade_max: hit.targetGradeMax,
    is_public_domain: false,
    library_url: buildLibraryUrl(hit.title, hit.isbn13),
    aladin_url: null,
  };
}

async function upsertHit(port: BooksAdminPort, hit: IsbnHit): Promise<Book> {
  const existing = await port.findByIsbn(hit.isbn13);
  if (existing) return existing;
  return port.insertBook(rawHitToBookInsert(hit));
}

const MAX_RESULTS = 10;

/**
 * 시드가 고른 책(curated)을 먼저, 그 뒤에 외부 소스 결과를 붙인다.
 * 외부 소스는 아동·청소년 부가기호가 붙은 책만 주므로(source.ts) 교양(0)으로 분류된
 * 좋은 책 — 아몬드, 어린 왕자 — 은 여기 앞부분이 아니면 검색에 안 나온다.
 */
export async function searchAndUpsertBooks(
  port: BooksAdminPort,
  source: BookSource,
  query: string,
): Promise<SearchResult> {
  const q = query.trim();
  if (!q) return { ok: true, books: [] };

  const curated = await port.searchCurated(q, MAX_RESULTS);

  let hits: RawBookHit[];
  try {
    hits = await source.search(q);
  } catch (err) {
    if (err instanceof BookSourceError) {
      console.error("[books] source error:", err);
      return {
        ok: false,
        code: "book_source_unavailable",
        message: "지금 책을 검색할 수 없어. 잠시 후 다시 해봐.",
        status: 503,
      };
    }
    throw err;
  }

  const withIsbn = hits.filter((h): h is IsbnHit => h.isbn13 !== null);
  const books: Book[] = [...curated];
  const seen = new Set(curated.map((b) => b.id));
  for (const hit of withIsbn) {
    if (books.length >= MAX_RESULTS) break;
    const book = await upsertHit(port, hit);
    if (seen.has(book.id)) continue;
    seen.add(book.id);
    books.push(book);
  }
  return { ok: true, books };
}
