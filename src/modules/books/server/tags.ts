/**
 * 검색 결과용 키워드 기반 장르 태그 매핑.
 *
 * `ai.normalizeGenreTags`(LLM 호출)로 바꾸지 않는다 — 검색 한 번에 새로 들어오는
 * 책마다 LLM을 부르면 학생이 검색 결과를 그만큼 더 기다리게 된다.
 * `normalizeGenreTags`는 저장된 책을 배치로 재태깅하는 함수다 — `npm run ai:retag`.
 * 여기서 잡는 것은 KDC 대분류로 확실한 비문학(역사·예술·과학·인물심리)뿐이고,
 * 문학 장르(동화·성장소설·판타지·추리…)는 그 배치가 채운다 (docs/prompts.md §5).
 *
 * 태그 목록 자체는 복제하지 않고 `ai` 모듈 것을 그대로 쓴다 — `genre_stamps.genre`도
 * 같은 목록을 기준으로 하므로, 목록이 두 곳이면 한쪽만 고쳤을 때 도장이 안 찍힌다.
 */
import { GENRE_TAGS, tagsFromKdcMajor, type GenreTag } from "@/modules/ai";

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

  // NLK SEOJI 의 SUBJECT 는 분류 '이름' 이 아니라 KDC 대분류 한 자리 숫자다 ("8", "3").
  // 실응답 360건에서 98% 가 숫자였고, 그래서 위 키워드 규칙은 사실상 한 건도 걸리지 않았다
  // (태그 0개 359/360). 숫자 매핑은 ai 모듈이 주인이다 (modules/ai/kdc.ts).
  for (const code of [rawCategory, kdc]) {
    for (const tag of tagsFromKdcMajor(code)) tags.add(tag);
  }

  return Array.from(tags).slice(0, 4);
}
