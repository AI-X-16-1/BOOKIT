/**
 * reader/server/dict — 단어 탭 사전. owner: 강민구
 *
 * 국립국어원 한국어기초사전 오픈 API 를 감싼다.
 * 표준국어대사전이 아니라 기초사전을 쓰는 이유는 학습자용이라 뜻풀이가 쉽기 때문이다.
 * 표준국어대사전 뜻풀이는 초등학생이 읽어도 모른다.
 *
 * 키는 서버 환경변수에만 둔다. 브라우저에서 직접 부르지 않는다 —
 * 키가 노출되고, 하루 5만 건 한도를 아무나 태울 수 있다.
 *
 * 문맥은 보지 않는다. 대신 뜻을 여러 개 돌려주고 아이가 글에 맞는 뜻을 고른다 (#43).
 * '눈은 아니 오고' 를 누르면 감각 기관 '눈' 과 하늘에서 내리는 '눈' 이 함께 뜬다.
 */
import "server-only";

import type { DictSense, ReaderDictResponse } from "../schema";

const ENDPOINT = "https://krdict.korean.go.kr/api/search";
const SOURCE = "국립국어원 한국어기초사전";

/** num 은 아무 숫자나 받지 않는다. 3 을 넣으면 error_code 103 이 온다. */
const NUM = 10;

const TIMEOUT_MS = 5_000;

/**
 * 원형 후보를 한 번에 몇 개까지 조회하나. 병렬로 부르므로 지연은 늘지 않지만,
 * 낱말 하나에 호출이 수십 건 나가면 하루 한도를 금방 태운다.
 */
const MAX_CANDIDATES = 8;

/**
 * 화면에 보여줄 뜻의 최대 개수. 바텀시트가 스크롤 없이 들어가는 선이다.
 * 3개로 자르면 "쓰입니다" 의 '이용되다'(쓰이다³), "흐린" 의 '날씨가 맑지 않다'(5번 뜻)가
 * 잘려 나간다 — 아이가 본문에서 가장 자주 만나는 뜻인데도.
 */
const MAX_SENSES = 5;

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
export async function lookup(word: string): Promise<ReaderDictResponse> {
  const query = word.trim();
  if (!query) throw new DictError("not_found", "찾을 단어가 없어.");

  const key = process.env.KRDICT_API_KEY?.trim();
  if (!key) {
    throw new DictError(
      "not_configured",
      "KRDICT_API_KEY 가 비어 있다. .env.local 또는 Vercel 환경변수를 확인해라.",
    );
  }

  const group = await resolve(key, query);
  if (group.length > 0) return toResponse(group);

  throw new DictError("not_found", `'${query}'${topic(query)} 사전에 없는 말이야.`);
}

/**
 * 같은 표기의 표제어 묶음을 응답 하나로 만든다.
 *
 * 쉬운 등급부터 본다. **같은 등급의 표제어끼리는 첫 뜻부터 번갈아** 넣고,
 * 더 어려운 등급의 표제어는 그 뒤에 온다.
 *   눈¹(감각 기관, 초급) · 눈⁴(하늘에서 내리는 눈, 초급) → 눈¹-1, 눈⁴-1, 눈¹-2 …
 *     표제어째로 이어 붙이면 눈¹ 의 뜻만으로 다섯 칸이 차서 눈⁴ 가 잘린다.
 *   흐리다(형용사, 초급) · 흐리다(동사, 고급) → 형용사 뜻 1~5
 *     5번 뜻이 '날씨가 맑지 않다' 다. 등급을 무시하고 번갈아 넣으면 이게 잘린다.
 *
 * definition 은 senses[0] 과 같다. 공유 계약(DictResponse)을 쓰는 쪽이 깨지지 않게 남긴다.
 */
function toResponse(group: DictEntry[]): ReaderDictResponse {
  const senses: DictSense[] = [];

  for (const tier of gradeTiers(group)) {
    const depth = Math.max(...tier.map((entry) => entry.senses.length));
    for (let index = 0; index < depth; index++) {
      for (const entry of tier) {
        const definition = entry.senses[index];
        if (definition) senses.push({ definition });
      }
    }
  }
  senses.splice(MAX_SENSES);

  return {
    word: group[0].word,
    definition: senses[0].definition,
    source: SOURCE,
    senses,
  };
}

/**
 * 아이가 누른 낱말을 사전 표제어 묶음으로 옮긴다. 못 찾으면 빈 배열.
 *
 * 아이는 본문에서 "제비가", "만났습니다" 를 누르지 "제비", "만나다" 를 누르지 않는다.
 * 형태소 분석기를 붙이는 게 정석이지만 이 규모에 들일 것이 아니다. 대신 후보를
 * 넉넉히 만들고, **표제어가 글자까지 같은 것만** 받는다. 잘못 자른 후보는 사전에
 * 없으니 저절로 걸러진다 — 엉뚱한 뜻을 보여주느니 못 찾았다고 하는 편이 낫다.
 *
 * 우선순위:
 *   1. 누른 글자 그대로의 표제어
 *   2. 조사를 뗀 말이 대명사일 때 ("나를" → 나. API 안내는 '나르다' 를 가리킨다)
 *   3. API 의 활용 안내가 가리키는 원형 ("오고" → 오다)
 *   4. 조사를 뗀 체언 ("비가" → 비)
 *   5. 어미를 떼고 '-다' 를 붙인 용언 ("새침하게" → 새침하다)
 */
async function resolve(key: string, query: string): Promise<DictEntry[]> {
  const first = await search(key, query);

  const exact = byGrade(first.entries.filter((entry) => entry.word === query));
  if (exact.length > 0) return exact;

  const nouns = nounCandidates(query);
  const lemmas = unique(first.guides.map((target) => target.word));
  const predicates = predicateCandidates(query);

  const words = unique([...nouns, ...lemmas, ...predicates]).slice(0, MAX_CANDIDATES);
  const found = new Map(
    await Promise.all(
      words.map(async (word) => [word, (await search(key, word)).entries] as const),
    ),
  );

  const exactOf = (word: string, accept: (entry: DictEntry) => boolean) =>
    byGrade((found.get(word) ?? []).filter((entry) => entry.word === word && accept(entry)));

  for (const noun of nouns) {
    const pronoun = exactOf(noun, (entry) => entry.pos === "대명사");
    if (pronoun.length > 0) return pronoun;
  }

  for (const lemma of lemmas) {
    // "쓰이다1, 쓰이다3" 처럼 동음이의어 번호를 짚어 주면 그 안에서만 고른다.
    const supNos = first.guides
      .filter((target) => target.word === lemma && target.supNo !== null)
      .map((target) => target.supNo);
    const hit = exactOf(
      lemma,
      (entry) => supNos.length === 0 || supNos.includes(entry.supNo),
    );
    if (hit.length > 0) return hit;
  }

  for (const noun of nouns) {
    const hit = exactOf(noun, (entry) => !PREDICATE_POS.has(entry.pos));
    if (hit.length > 0) return hit;
  }

  for (const predicate of predicates) {
    const hit = exactOf(predicate, (entry) => PREDICATE_POS.has(entry.pos));
    if (hit.length > 0) return hit;
  }

  return [];
}

interface DictEntry {
  word: string;
  /** 동음이의어 번호. 없으면 0 */
  supNo: number;
  pos: string;
  /** 사전에 적힌 순서 그대로의 뜻풀이. 비어 있는 항목은 만들지 않는다 */
  senses: string[];
  /** 초급 / 중급 / 고급. 없을 수도 있다 */
  grade: string | null;
}

/** 활용 안내 항목이 가리키는 원형. "→ 오다1, 오다2" 의 한 조각 */
interface GuideTarget {
  word: string;
  supNo: number | null;
}

const PREDICATE_POS = new Set(["동사", "형용사"]);

async function search(
  key: string,
  query: string,
): Promise<{ entries: DictEntry[]; guides: GuideTarget[] }> {
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

  return parseItems(xml);
}

/**
 * 응답을 item 단위로 자른 뒤 그 안에서 sense 를 읽는다.
 *
 * definition 을 응답 전체에서 한 번에 긁으면 안 된다. 한 단어에 뜻이 여러 개라
 * 앞 단어의 두 번째 뜻이 다음 단어의 뜻으로 붙는다 — '나무' 로 검색하면
 * '나무라다' 의 뜻이 "집이나 가구를 만드는 재목" 이 되어버린다.
 * 아이가 단어를 눌렀는데 엉뚱한 뜻이 뜨는 건 조용히 지나가는 버그다.
 *
 * 활용형으로 검색하면 품사 없는 안내 항목이 온다:
 *   [오-] (오고, 오는데, 오니, …)→ 오다1, 오다2
 * 이건 뜻이 아니다. 화면에 내보내지 않고 가리키는 원형만 챙긴다.
 */
function parseItems(xml: string): { entries: DictEntry[]; guides: GuideTarget[] } {
  const entries: DictEntry[] = [];
  const guides: GuideTarget[] = [];

  for (const match of xml.matchAll(/<item>([\s\S]*?)<\/item>/g)) {
    const item = match[1];
    const word = decode(/<word>([\s\S]*?)<\/word>/.exec(item)?.[1]);
    if (!word) continue;

    const senses = [...item.matchAll(/<sense>[\s\S]*?<definition>([\s\S]*?)<\/definition>/g)]
      .map((sense) => decode(sense[1]))
      .filter(Boolean);
    if (senses.length === 0) continue;

    if (word.endsWith("-")) {
      guides.push(...parseGuide(senses[0]));
      continue;
    }

    entries.push({
      word,
      supNo: Number(decode(/<sup_no>([\s\S]*?)<\/sup_no>/.exec(item)?.[1])) || 0,
      pos: decode(/<pos>([\s\S]*?)<\/pos>/.exec(item)?.[1]),
      senses,
      grade: decode(/<word_grade>([\s\S]*?)<\/word_grade>/.exec(item)?.[1]) || null,
    });
  }

  return { entries, guides };
}

function parseGuide(definition: string): GuideTarget[] {
  const arrow = definition.lastIndexOf("→");
  if (arrow < 0) return [];

  return definition
    .slice(arrow + 1)
    .split(",")
    .map((part) => /^\s*([가-힣]+다)(\d*)\s*$/.exec(part))
    .filter((match): match is RegExpExecArray => match !== null)
    .map((match) => ({ word: match[1], supNo: match[2] ? Number(match[2]) : null }));
}

/**
 * 같은 표기의 표제어를 word_grade 가 쉬운 순(초급 → 중급 → 고급)으로 둔다.
 * 초등학생이 쓸 법한 쪽을 앞에 두기 위해서다. 등급이 같으면 API 가 준 순서를 지킨다.
 */
function byGrade(entries: DictEntry[]): DictEntry[] {
  return [...entries].sort((a, b) => gradeRank(a.grade) - gradeRank(b.grade));
}

/** byGrade 로 정렬된 묶음을 같은 등급끼리 자른다. 순서는 그대로 둔다 */
function gradeTiers(sorted: DictEntry[]): DictEntry[][] {
  const tiers: DictEntry[][] = [];
  for (const entry of sorted) {
    const last = tiers.at(-1);
    if (last && gradeRank(last[0].grade) === gradeRank(entry.grade)) last.push(entry);
    else tiers.push([entry]);
  }
  return tiers;
}

function gradeRank(grade: string | null): number {
  if (grade === "초급") return 0;
  if (grade === "중급") return 1;
  if (grade === "고급") return 2;
  return 3;
}

/**
 * 낱말 끝의 조사를 떼어 체언 후보를 만든다. "첨지에게는" 처럼 조사가 겹치면
 * 한 번 더 뗀다.
 *
 * 한 글자 어간도 후보에 넣는다 — "비가", "눈은", "돈이" 가 아이가 누르는 낱말의
 * 흔한 모양이다. "우리" 에서 "리" 를 떼는 식의 오답은 1단계(글자 그대로의 표제어)가
 * 먼저 잡으므로 여기까지 오지 않는다.
 *
 * 긴 조사부터 본다. "에서" 를 "서" 로 먼저 자르면 안 된다.
 * '입니다' 같은 서술격 조사도 여기서 뗀다 ("일입니다" → 일).
 */
const PARTICLES = [
  "이었습니다", "였습니다", "이었다", "입니다", "이에요", "이라는", "이야말로",
  "에게서", "한테서", "으로서", "으로써", "이라고", "라고는", "야말로",
  "에서", "에게", "한테", "께서", "부터", "까지", "처럼", "보다", "만큼",
  "마다", "조차", "라도", "이나", "으로", "이란", "이라", "라는", "였다",
  "이다", "이고", "이며", "이랑",
  "은", "는", "이", "가", "을", "를", "의", "에", "와", "과",
  "도", "만", "로", "나", "야", "여", "께", "랑",
];

function nounCandidates(word: string): string[] {
  const out: string[] = [];
  const strip = (current: string, depth: number) => {
    for (const particle of PARTICLES) {
      if (!current.endsWith(particle) || current.length <= particle.length) continue;
      const stem = current.slice(0, -particle.length);
      out.push(stem);
      if (depth < 2) strip(stem, depth + 1);
    }
  };
  strip(word, 1);
  return unique(out).slice(0, 4);
}

/**
 * 어미를 떼고 '-다' 를 붙여 용언 원형 후보를 만든다.
 *
 * 기초사전 API 는 "오고" 같은 활용형은 안내해 주지만 "되었다", "만났습니다",
 * "새침하게" 는 0건을 돌려준다. 그래서 흔한 어미만 직접 뗀다.
 *
 * 줄어든 모음과 받침도 되돌린다.
 *   만났 → 만나 (받침 ㅆ)   쓰러집 → 쓰러지 (받침 ㅂ)   큰 → 크 (받침 ㄴ)
 *   해 → 하    돼 → 되    봐 → 보    줘 → 주    쳐 → 치
 *
 * 불규칙 활용("추워" → 춥다, "물었다" → 묻다)은 다루지 않는다. 규칙이 많고,
 * 틀리게 되돌리면 다른 낱말이 걸린다.
 */
const ENDINGS = [
  "었습니다", "았습니다", "였습니다", "었어요", "았어요", "였어요",
  "었는지", "았는지", "였는지", "었던", "았던", "였던",
  "었다", "았다", "였다", "습니다", "니다", "어요", "아요", "는다",
  "다가", "어서", "아서", "으니", "으면", "으며", "으러", "니까", "면서",
  "는지", "은지", "을까", "거든", "다는", "라고",
  "게", "고", "며", "면", "지", "는", "던", "은", "을", "러", "기", "니", "자",
  "다", "어", "아", "여", "",
];

function predicateCandidates(word: string): string[] {
  const out: string[] = [];

  for (const ending of ENDINGS) {
    if (!word.endsWith(ending)) continue;
    const rest = ending ? word.slice(0, -ending.length) : word;
    if (!rest) continue;

    for (const stem of restoreStem(rest)) out.push(`${stem}다`);
  }

  return unique(out).filter((candidate) => candidate !== word);
}

const HANGUL_BASE = 0xac00;
const JONG_DROPPABLE = new Set([4, 8, 17, 20]); // ㄴ ㄹ ㅂ ㅆ

/** 줄어든 모음 → 원래 모음 (중성 번호). ㅐ 는 초성이 ㅎ 일 때만 ㅏ 로 되돌린다 */
const VOWEL_RESTORE: Record<number, number> = { 9: 8, 14: 13, 6: 20, 10: 11 };

function restoreStem(rest: string): string[] {
  const head = rest.slice(0, -1);
  const code = rest.charCodeAt(rest.length - 1) - HANGUL_BASE;
  if (code < 0 || code > 11171) return [rest];

  const cho = Math.floor(code / 588);
  const jung = Math.floor((code % 588) / 28);
  const jong = code % 28;
  const syllable = (j: number, t: number) =>
    String.fromCharCode(HANGUL_BASE + cho * 588 + j * 28 + t);

  const variants = [rest];
  const bases = JONG_DROPPABLE.has(jong) ? [jong, 0] : [jong];

  for (const t of bases) {
    variants.push(head + syllable(jung, t));
    const restored = VOWEL_RESTORE[jung] ?? (jung === 1 && cho === 18 ? 0 : undefined);
    // 모음이 줄었으면 받침 ㅆ·ㄴ 등은 어미 쪽이다 ("했" → 하, "봤" → 보)
    if (restored !== undefined) {
      variants.push(head + syllable(restored, JONG_DROPPABLE.has(t) ? 0 : t));
    }
  }

  return unique(variants);
}

function unique(values: string[]): string[] {
  return [...new Set(values)];
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
