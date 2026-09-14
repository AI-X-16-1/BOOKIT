/**
 * 장르 태그 정규화 실호출 검증 — `npm run ai:tags`
 *
 * 보는 것은 세 가지다.
 *   1. 알라딘 카테고리 원문에서 고정 태그가 제대로 뽑히는가
 *   2. 목록에 없는 태그를 만들어내지 않는가 (만들면 sanitize 가 경고를 찍는다)
 *   3. 맞는 태그가 없는 책에서 억지로 채우지 않는가
 *
 * 무료 티어 분당 한도 때문에 호출 사이를 벌린다 (scripts/ai-gaps.ts 와 같은 이유).
 */
import { GENRE_TAGS, LlmError, normalizeGenreTags } from "@/modules/ai";
import type { BookClassification } from "@/modules/ai";

const SPACING_MS = 5_000;
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

interface Sample {
  book: BookClassification;
  expect: string;
}

const SAMPLES: Sample[] = [
  {
    expect: "성장소설·동화·모험 계열",
    book: {
      title: "마당을 나온 암탉",
      author: "황선미",
      categories: ["국내도서 > 어린이 > 초등 3-4학년 > 창작동화"],
      kdc: "813.8",
    },
  },
  {
    expect: "고전 포함",
    book: {
      title: "어린 왕자",
      author: "앙투안 드 생텍쥐페리",
      categories: ["외국도서 > 문학 > 소설 > 고전문학"],
    },
  },
  {
    expect: "역사·가족 계열",
    book: {
      title: "몽실 언니",
      author: "권정생",
      categories: ["국내도서 > 어린이 > 초등 5-6학년 > 역사동화"],
      description:
        "한국전쟁 전후를 배경으로, 다리를 저는 소녀 몽실이가 동생을 돌보며 살아가는 이야기.",
    },
  },
  {
    expect: "과학 포함",
    book: {
      title: "why? 우주",
      author: "이광웅",
      categories: ["국내도서 > 어린이 > 초등 학습만화 > 과학"],
    },
  },
  {
    expect: "빈 배열이거나 아주 적게 — 맞는 태그가 없다",
    book: {
      title: "초등 수학 문제집 5-1",
      author: "편집부",
      categories: ["국내도서 > 초등참고서 > 5학년 > 수학"],
    },
  },
];

async function main() {
  console.log(`고정 태그 ${GENRE_TAGS.length}개: ${GENRE_TAGS.join(", ")}\n`);

  for (const { book, expect } of SAMPLES) {
    const startedAt = Date.now();
    const { tags } = await normalizeGenreTags(book);
    const ms = Date.now() - startedAt;

    const unknown = tags.filter((tag) => !GENRE_TAGS.includes(tag));
    const withinCap = tags.length <= 4;

    console.log(
      `${unknown.length === 0 && withinCap ? "✓" : "✕"} ${book.title.padEnd(18)} ` +
        `${String(ms).padStart(5)}ms  [${tags.join(", ") || "없음"}]`,
    );
    console.log(`     기대: ${expect}`);

    await sleep(SPACING_MS);
  }
}

main().catch((error: unknown) => {
  if (error instanceof LlmError) {
    console.error(`\n✕ [${error.kind}] ${error.message}`);
    process.exitCode = 1;
    return;
  }
  console.error(`\n✕ ${error instanceof Error ? error.stack : String(error)}`);
  process.exitCode = 1;
});
