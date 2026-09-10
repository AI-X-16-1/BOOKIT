/**
 * reader/server/dict — 단어 탭 사전. owner: 강민구
 *
 * 국립국어원 한국어기초사전 오픈 API 를 감싼다.
 * 표준국어대사전이 아니라 기초사전을 쓰는 이유는 학습자용이라 뜻풀이가 쉽기 때문이다.
 * 표준국어대사전 뜻풀이는 초등학생이 읽어도 모른다.
 *
 * 키는 서버 환경변수에만 둔다. 브라우저에서 직접 부르지 않는다 —
 * 키가 노출되고, 하루 5만 건 한도를 아무나 태울 수 있다.
 */
import "server-only";

import type { DictResponse } from "@/shared/types";

const ENDPOINT = "https://krdict.korean.go.kr/api/search";
const SOURCE = "국립국어원 한국어기초사전";

/** num 은 아무 숫자나 받지 않는다. 3 을 넣으면 error_code 103 이 온다. */
const NUM = 10;

const TIMEOUT_MS = 5_000;

export type DictErrorKind = "not_configured" | "not_found" | "upstream";

export class DictError extends Error {
  constructor(
    readonly kind: DictErrorKind,
    message: string,
    options?: { cause?: unknown },
  ) {
    super(message, options);
    this.name = "DictError";
  }
}

/**
 * 단어 하나의 뜻을 찾는다.
 *
 * 환경변수는 모듈 스코프가 아니라 호출 시점에 읽는다 — 키 없는 CI 빌드가 깨지지 않게.
 */
export async function lookup(word: string): Promise<DictResponse> {
  const query = word.trim();
  if (!query) throw new DictError("not_found", "찾을 단어가 없어.");


  const key = process.env.KRDICT_API_KEY?.trim();
  if (!key) {
    throw new DictError(
      "not_configured",
      "KRDICT_API_KEY 가 비어 있다. .env.local 또는 Vercel 환경변수를 확인해라.",
    );
  }

  const url = `${ENDPOINT}?key=${encodeURIComponent(key)}&q=${encodeURIComponent(query)}&num=${NUM}`;

  let xml: string;
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS) });
    if (!response.ok) {
      throw new DictError("upstream", `사전 API 가 ${response.status} 를 돌려줬다.`);
    }
    xml = await response.text();
  } catch (error) {
    if (error instanceof DictError) throw error;
    throw new DictError("upstream", "사전 API 를 부르지 못했다.", { cause: error });
  }

  const apiError = /<error_code>(.*?)<\/error_code>/.exec(xml);
  if (apiError) {
    const message = /<message>(.*?)<\/message>/.exec(xml)?.[1] ?? "";
    throw new DictError("upstream", `사전 API 오류 ${apiError[1]}: ${message}`);
  }

  const entry = pickEntry(parseItems(xml), query);
  if (!entry) {
    throw new DictError("not_found", `'${query}'${topic(query)} 사전에 없는 말이야.`);
  }

  return { word: entry.word, definition: entry.definition, source: SOURCE };
}

interface DictEntry {
  word: string;
  definition: string;
  /** 초급 / 중급 / 고급. 없을 수도 있다 */
  grade: string | null;
  /** 검색어와 글자가 정확히 같은가 */
  exact: boolean;
}

/**
 * 응답을 item 단위로 자른 뒤 그 안에서 sense 를 읽는다.
 *
 * definition 을 응답 전체에서 한 번에 긁으면 안 된다. 한 단어에 뜻이 여러 개라
 * 앞 단어의 두 번째 뜻이 다음 단어의 뜻으로 붙는다 — '나무' 로 검색하면
 * '나무라다' 의 뜻이 "집이나 가구를 만드는 재목" 이 되어버린다.
 * 아이가 단어를 눌렀는데 엉뚱한 뜻이 뜨는 건 조용히 지나가는 버그다.
 */
function parseItems(xml: string): DictEntry[] {
  const entries: DictEntry[] = [];

  for (const match of xml.matchAll(/<item>([\s\S]*?)<\/item>/g)) {
    const item = match[1];
    const word = decode(/<word>([\s\S]*?)<\/word>/.exec(item)?.[1]);
    if (!word) continue;

    // sense_order 가 1 인 뜻, 없으면 첫 번째 뜻. 여러 뜻을 다 보여주기엔
    // 바텀시트가 좁고, 아이에게는 대표 뜻 하나가 낫다.
    const definition = decode(
      /<sense>[\s\S]*?<definition>([\s\S]*?)<\/definition>/.exec(item)?.[1],
    );
    if (!definition) continue;

    entries.push({
      word,
      definition,
      grade: decode(/<word_grade>([\s\S]*?)<\/word_grade>/.exec(item)?.[1]) || null,
      exact: false,
    });
  }

  return entries;
}

/**
 * 검색 결과 중 아이에게 보여줄 하나를 고른다.
 *
 * 1. 검색어와 글자가 정확히 같은 것
 * 2. 그중 word_grade 가 쉬운 것 (초급 → 중급 → 고급)
 *
 * '나무' 를 눌렀는데 '나무라다' 가 뜨면 안 되므로 정확 일치가 우선이다.
 * 등급을 보는 이유는 같은 표기의 단어가 여럿일 때 초등학생이 쓸 법한 쪽을
 * 고르기 위해서다.
 */
function pickEntry(entries: DictEntry[], query: string): DictEntry | null {
  if (entries.length === 0) return null;

  const scored = entries.map((entry) => ({
    ...entry,
    exact: entry.word === query,
  }));

  const exact = scored.filter((entry) => entry.exact);
  const pool = exact.length > 0 ? exact : scored;

  return [...pool].sort((a, b) => gradeRank(a.grade) - gradeRank(b.grade))[0];
}

function gradeRank(grade: string | null): number {
  if (grade === "초급") return 0;
  if (grade === "중급") return 1;
  if (grade === "고급") return 2;
  return 3;
}

function decode(value: string | undefined): string {
  if (!value) return "";
  return value
    .trim()
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&")
    .trim();
}

/**
 * 은/는 조사를 받침에 맞춰 고른다.
 *
 * 사전에 없는 말은 아이 화면에 그대로 뜬다. "'잎싹' 는 없어" 처럼 조사가 틀리면
 * 아이가 읽는 첫 한국어가 비문이 된다. 한글 음절의 받침은 코드포인트로 계산된다.
 */
function topic(word: string): string {
  const last = word.trim().at(-1);
  if (!last) return "는";

  const code = last.charCodeAt(0);
  if (code < 0xac00 || code > 0xd7a3) return "는"; // 한글 음절이 아니면 기본값
  return (code - 0xac00) % 28 === 0 ? "는" : "은";
}
