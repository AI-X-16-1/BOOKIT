/**
 * ai/server/genre-tags — 프롬프트 #5 장르 태그 정규화. owner: 강민구
 *
 * 알라딘 카테고리 문자열과 KDC 코드를 앱의 고정 태그 15종으로 옮긴다.
 * 사용자에게 안 보이는 배치 작업이다 — 책을 처음 저장할 때 한 번 돌리고
 * books.tags 에 넣어 두면, 이후 추천과 도장판은 DB 만 읽는다.
 *
 * 소비처가 둘이다.
 *   books (이승환)  장르 인접 추천
 *   growth (문민재) 장르 도장판 — genre_stamps.genre
 * 둘 다 GENRE_TAGS 밖의 값을 받으면 처리할 방법이 없다. 그래서 여기서 반드시 거른다.
 */
import "server-only";

import { GENRE_TAGS, genreTagsSchema, type GenreTag } from "../schema";
import { callJson } from "./llm";
import {
  genreTagsSystem,
  genreTagsUser,
  type BookClassification,
} from "./prompts";

/** 화면에 태그 칩이 4개까지 들어간다 (docs/prompts.md §5). */
const MAX_TAGS = 4;

const ALLOWED = new Set<string>(GENRE_TAGS);

/**
 * 책 한 권의 장르 태그를 정규화한다.
 *
 * 배치로 돌릴 때는 호출부가 간격을 벌려야 한다 — 수백 권을 연속으로 돌리면 분당 한도(429)에
 * 걸릴 수 있다. 무료 키라면 반드시 걸린다 (scripts/ai-gaps.ts 의 paced 참고).
 *
 * 결과가 빈 배열일 수 있다. 맞는 태그가 없는 책이라는 뜻이고 오류가 아니다.
 * 억지로 채우면 엉뚱한 도장이 찍히고 추천이 어긋난다.
 */
export async function normalizeGenreTags(
  book: BookClassification,
): Promise<{ tags: GenreTag[] }> {
  const { tags } = await callJson({
    label: "genre-tags",
    schema: genreTagsSchema,
    system: genreTagsSystem(GENRE_TAGS),
    user: genreTagsUser(book),
    // 사용자가 기다리지 않는 배치 작업이라 싸게 간다.
    effort: "low",
    maxTokens: 1024,
  });

  return { tags: sanitize(tags) };
}

/**
 * 스키마가 enum 으로 막고 있어도 한 번 더 거른다 (CLAUDE.md §6).
 * 모르는 값은 버리고, 중복을 없애고, 4개로 자른다.
 */
export function sanitize(tags: readonly string[]): GenreTag[] {
  const seen = new Set<string>();
  const kept: GenreTag[] = [];

  for (const raw of tags) {
    const tag = raw.trim();
    if (!ALLOWED.has(tag)) {
      console.warn(`[ai:genre-tags] 목록에 없는 태그를 버린다: ${tag}`);
      continue;
    }
    if (seen.has(tag)) continue;

    seen.add(tag);
    kept.push(tag as GenreTag);
    if (kept.length >= MAX_TAGS) break;
  }

  return kept;
}
