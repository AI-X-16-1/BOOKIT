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

/**
 * 읽고 독후감을 쓸 책이 아닌 파생물 — 원작 제목이 그대로 붙어 검색에 딸려온다
 * ("마당을 나온 암탉 색칠놀이", "PlayFACTO 퍼즐북 헥시아몬드"). 제목만 보고 거른다.
 */
const DERIVATIVE_RE =
  /워크북|스티커|색칠|퍼즐|문제집|학습지|활동지|놀이북|만들기|따라\s*그리기|컬러링|미니북|패키지|세트|전\s*\d+\s*권|\d+\s*권\s*세트/;

export function isDerivative(title: string): boolean {
  return DERIVATIVE_RE.test(title);
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
    if (!(err instanceof BookSourceError)) throw err;
    // 국립중앙도서관 API 는 5초 타임아웃이 잦다 (프로덕션 2026-09-15). 외부가 죽어도
    // 시드에서 찾은 책은 보여준다 — 시드에도 없을 때만 "검색할 수 없어" 다.
    console.error("[books] source error:", err);
    if (curated.length > 0) return { ok: true, books: curated };
    return {
      ok: false,
      code: "book_source_unavailable",
      message: "지금 책을 검색할 수 없어. 잠시 후 다시 해봐.",
      status: 503,
    };
  }

  // NLK 는 시리즈명·설명까지 넓게 맞춰서 "아몬드" 에 "완득이" 가 딸려온다.
  // 제목이나 저자에 검색어가 실제로 들어간 것만 받고, 독후감 대상이 아닌 파생물은 뺀다.
  const needle = q.toLowerCase();
  const withIsbn = hits.filter(
    (h): h is IsbnHit =>
      h.isbn13 !== null &&
      (h.title.toLowerCase().includes(needle) || h.author.toLowerCase().includes(needle)) &&
      !isDerivative(h.title),
  );
  // 같은 책의 판본이 ISBN 만 다르게 여러 개 온다 (아몬드 종이책 3종). 제목+저자로 하나만
  const editionKey = (h: RawBookHit) =>
    `${h.title}|${h.author}`.replace(/\s+/g, "").toLowerCase();
  const seenEditions = new Set<string>();
  const distinct = withIsbn.filter((h) => {
    const key = editionKey(h);
    if (seenEditions.has(key)) return false;
    seenEditions.add(key);
    return true;
  });
  const books: Book[] = [...curated];
  const seen = new Set(curated.map((b) => b.id));
  for (const hit of distinct) {
    if (books.length >= MAX_RESULTS) break;
    const book = await upsertHit(port, hit);
    if (seen.has(book.id)) continue;
    seen.add(book.id);
    books.push(book);
  }
  return { ok: true, books };
}
