/**
 * ai/kdc — KDC 대분류를 앱의 장르 태그로 옮긴다. owner: 강민구
 *
 * 왜 여기 있나: GENRE_TAGS 의 주인이 ai 모듈이다 (schema.ts). 분류 코드를 태그로
 * 바꾸는 규칙이 books 와 ai 두 곳에 흩어지면 한쪽만 고쳤을 때 도장판이 모르는 장르를 받는다.
 *
 * 실측 (2026-09-16, NLK 실응답 360건):
 *   - SEOJI 의 SUBJECT 는 분류 '이름' 이 아니라 KDC 대분류 한 자리 숫자다 ("8", "3"). 98% 존재
 *   - SEOJI 의 KDC(전체 분류기호)는 5% 만 존재해서 쓸 수 없다
 *   - nl.go.kr 검색 API 의 classNo(전체 KDC)는 61% 존재하지만 **장르를 못 가른다**:
 *     「마당을 나온 암탉」(동화)과 「아몬드」(청소년 소설)가 똑같이 813.7 이다.
 *     813 은 "한국 소설" 이고 소수점 아래는 시대 구분이라, 우리 태그(동화·성장소설·판타지…)와
 *     대응하지 않는다. 그래서 전체 분류기호는 쓰지 않는다.
 *
 * 결론: 대분류로는 **비문학만** 잡는다. 문학(8)의 장르는 normalizeGenreTags(#5) 가 맡는다.
 */
import type { GenreTag } from "./schema";

/**
 * KDC 대분류 → 태그. 확신이 없으면 넣지 않는다 — 틀린 태그는 태그 없음보다 나쁘다.
 * 장르 도장판(genre_stamps)과 추천이 이 값을 그대로 믿는다.
 *
 * 뺀 것과 이유:
 *   0 총류 · 2 종교 · 7 언어 — 대응하는 태그가 없다
 *   3 사회과학 — 실측에서 "[어린이 생활 동화] 괜찮은 줄 알았어" 가 3 이다. 생활동화가
 *                섞여 들어와 "사회" 로 오태깅된다. 오태깅 비용이 이득보다 크다
 *   8 문학     — 성장소설·판타지·SF·추리·동화·모험·우정·인물심리·가족·고전이 전부 여기다.
 *                숫자 하나로는 못 가른다. AI 재태깅(#5) 몫이다
 */
const MAJOR_TO_TAG: Record<string, GenreTag> = {
  "1": "인물심리", // 철학·심리학
  "4": "과학", // 자연과학
  "5": "과학", // 기술과학
  "6": "예술",
  "9": "역사",
};

/**
 * KDC 대분류 한 자리로 태그를 고른다. 모르는 값이면 빈 배열이다.
 *
 * 받는 값은 "8" 같은 한 자리이거나 "813.7" 같은 전체 분류기호일 수 있다 — 맨 앞자리만 본다.
 */
export function tagsFromKdcMajor(code: string | null | undefined): GenreTag[] {
  const major = code?.trim().charAt(0);
  if (!major) return [];
  const tag = MAJOR_TO_TAG[major];
  return tag ? [tag] : [];
}

/** 대분류로 장르를 정할 수 없어 AI 재태깅이 필요한 책인지. 문학과 미분류가 여기 걸린다. */
export function needsAiTagging(code: string | null | undefined): boolean {
  return tagsFromKdcMajor(code).length === 0;
}
