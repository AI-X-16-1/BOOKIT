/**
 * 검색 결과용 키워드 기반 장르 태그 매핑.
 *
 * `ai.normalizeGenreTags`(LLM 호출)로 바꾸지 않는다 — 검색 한 번에 새로 들어오는
 * 책마다 LLM을 부르면 학생이 검색 결과를 그만큼 더 기다리게 된다.
 * `normalizeGenreTags`는 원래 저장된 책을 나중에 배치로 재태깅하기 위한 함수다.
 * TODO(나중에 배치 재태깅): `books` 테이블에 이미 들어온 행들을
 * `ai.normalizeGenreTags`로 일괄 재분류하는 배치 작업을 별도로 만들 것
 * (docs/prompts.md §5, docs/superpowers/specs/2026-09-14-books-search-recommend-design.md).
 *
 * 태그 목록 자체는 복제하지 않고 `ai` 모듈 것을 그대로 쓴다 — `genre_stamps.genre`도
 * 같은 목록을 기준으로 하므로, 목록이 두 곳이면 한쪽만 고쳤을 때 도장이 안 찍힌다.
 */
import { GENRE_TAGS, type GenreTag } from "@/modules/ai";

export { GENRE_TAGS, type GenreTag };

const KEYWORD_RULES: Array<[GenreTag, RegExp]> = [
  ["판타지", /판타지|마법|요정/],
  ["SF", /SF|공상과학|우주/],
  ["추리", /추리|미스터리|탐정/],
  ["동화", /동화|그림책/],
  ["역사", /역사|위인|전기/],
  ["과학", /과학|자연과학|수학/],
  ["모험", /모험|탐험/],
  ["우정", /우정|친구/],
  ["인물심리", /심리|감정/],
  ["가족", /가족|부모|형제/],
  ["사회", /사회|경제|정치/],
  ["자연", /자연|환경|동물|식물/],
  ["예술", /예술|미술|음악/],
  ["고전", /고전|명작/],
  // "한국소설"은 뺐다 — 국내 소설이라는 이유만으로 성장소설을 붙이면 과다 태깅된다.
  ["성장소설", /성장|청소년소설/],
];

/**
 * KDC 대분류(맨 앞자리)로 넓게 잡는 보조 규칙. 확신 없으면 태그를 붙이지 않는다.
 * "8"(문학 전체 — 시·수필까지 포함)은 뺐다 — 너무 넓어서 성장소설로 잘못 넘겨짚는다.
 */
const KDC_MAJOR_RULES: Record<string, GenreTag> = {
  "9": "역사",
  "4": "과학",
};

export function mapToGenreTags(
  rawCategory: string | null,
  kdc: string | null,
): GenreTag[] {
  const tags = new Set<GenreTag>();

  if (rawCategory) {
    for (const [tag, pattern] of KEYWORD_RULES) {
      if (pattern.test(rawCategory)) tags.add(tag);
    }
  }

  if (tags.size === 0 && kdc) {
    const major = kdc.trim().charAt(0);
    const tag = KDC_MAJOR_RULES[major];
    if (tag) tags.add(tag);
  }

  return Array.from(tags).slice(0, 4);
}
