/**
 * books 모듈 목 데이터.
 * 리턴 타입은 @/shared/types 의 API 계약 그대로다.
 *
 * ⚠️ server/source.ts의 mockSource가 이 파일의 BOOKS 배열을 "API 키 없을 때의 영구
 * 폴백 데이터 소스"로 사용한다 — 실제 API 키가 붙어도 이 파일을 통째로 지우면 안 된다.
 * mockSource 자체가 나중에 제거될 때만 함께 정리한다.
 */
import type { Book, BookSearchResponse } from "@/shared/types";

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** 표지는 알라딘 image URL 이 붙기 전까지 토큰 그라데이션 자리표시자 (CLAUDE.md §10). */
export type CoverTone = "green" | "coral" | "blue" | "yellow";
export const COVER: Record<CoverTone, string> = {
  green: "bg-linear-160 from-green-light to-green",
  coral: "bg-linear-160 from-coral-light to-coral",
  blue: "bg-linear-160 from-blue to-blue-text",
  yellow: "bg-linear-160 from-yellow to-yellow-text-2",
};

export interface DemoBook extends Book {
  cover: CoverTone;
}

export const BOOKS: DemoBook[] = [
  { id: "b5", isbn13: "9788936434267", title: "아몬드", author: "손원평", publisher: "창비", cover_url: null, tags: ["성장", "한국소설"], target_grade_min: 6, target_grade_max: 9, is_public_domain: false, library_url: null, aladin_url: null, curated: true, cover: "green" },
  { id: "b6", isbn13: "9788936456788", title: "완득이", author: "김려령", publisher: "창비", cover_url: null, tags: ["성장", "한국소설"], target_grade_min: 6, target_grade_max: 9, is_public_domain: false, library_url: null, aladin_url: null, curated: true, cover: "coral" },
  { id: "b7", isbn13: "9788932917245", title: "마당을 나온 암탉", author: "황선미", publisher: "사계절", cover_url: null, tags: ["동화", "성장"], target_grade_min: 3, target_grade_max: 6, is_public_domain: false, library_url: null, aladin_url: null, curated: true, cover: "yellow" },
  { id: "b9", isbn13: "9788932473901", title: "어린 왕자", author: "생텍쥐페리", publisher: "문학동네", cover_url: null, tags: ["고전", "철학"], target_grade_min: 4, target_grade_max: 9, is_public_domain: false, library_url: null, aladin_url: null, curated: true, cover: "blue" },
  { id: "b15", isbn13: "9788947542524", title: "몽실 언니", author: "권정생", publisher: "창비", cover_url: null, tags: ["역사", "한국소설"], target_grade_min: 5, target_grade_max: 8, is_public_domain: false, library_url: null, aladin_url: null, curated: true, cover: "coral" },
];

/** GET /api/books/search?q= */
export async function searchBooks(q: string): Promise<BookSearchResponse> {
  await delay(200);
  const term = q.trim();
  if (!term) return { books: [] };
  return {
    books: BOOKS.filter(
      (b) => b.title.includes(term) || b.author.includes(term),
    ),
  };
}
