/**
 * 임시 장르 태그 매핑.
 *
 * TODO(ai 모듈 복구 후 교체): `ai.normalizeGenreTags`로 이관한다
 * (docs/prompts.md §5, docs/superpowers/specs/2026-09-14-books-search-recommend-design.md).
 * 태그 목록은 그 문서의 고정 15개를 그대로 복제한 것이다 — 여기서 새 태그를 만들지 않는다.
 */

export const BOOK_GENRE_TAGS = [
  "성장소설",
  "판타지",
  "SF",
  "추리",
  "동화",
  "역사",
  "과학",
  "모험",
  "우정",
  "인물심리",
  "가족",
  "사회",
  "자연",
  "예술",
  "고전",
] as const;

export type BookGenreTag = (typeof BOOK_GENRE_TAGS)[number];

const KEYWORD_RULES: Array<[BookGenreTag, RegExp]> = [
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
  ["성장소설", /성장|청소년소설|한국소설/],
];

/** KDC 대분류(맨 앞자리)로 넓게 잡는 보조 규칙. 확신 없으면 태그를 붙이지 않는다 */
const KDC_MAJOR_RULES: Record<string, BookGenreTag> = {
  "8": "성장소설",
  "9": "역사",
  "4": "과학",
};

export function mapToGenreTags(
  rawCategory: string | null,
  kdc: string | null,
): BookGenreTag[] {
  const tags = new Set<BookGenreTag>();

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
