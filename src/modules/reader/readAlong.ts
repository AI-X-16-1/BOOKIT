/**
 * reader/readAlong — 소리 내어 읽은 말을 본문 낱말에 맞춘다. owner: 강민구
 *
 * 9/18 마감 스프린트 ③ STT 낭독 하이라이트 (docs/sprint-0918.md, 기획 §3).
 * 아이가 읽는 대로 본문 색이 따라가는 노래방식 연출이다 (구글 Read Along 처럼).
 *
 * **판정이 아니라 시각 효과다.** 그래서 틀려도 된다 — 몇 낱말 놓쳐도 뒤에서 다시
 * 맞으면 따라잡으면 된다. 이 파일의 규칙이 느슨한 이유가 그것이다:
 *   - 조사가 달라도 같은 낱말로 본다 ("소녀" 와 "소녀가")
 *   - 앞이 잘려 들린 말도 받는다 ("같이" 와 본문의 "날개같이")
 *   - 붙어서 들린 말도 받는다 ("할수있다" 와 본문의 "할 수 있다")
 *   - **바로 다음 한두 낱말**은 비슷하기만 해도 받는다 — 실제 인식이 "해 → 회",
 *     "흰 → 흰색", "희고도 → 이고도" 로 들었다 (2026-09-18 크롬 실측, readAlong.test.ts).
 *     멀리 있는 낱말에는 쓰지 않는다. 짧은 말끼리는 대부분 한 글자 차이라 아무 데나 맞는다
 *   - 커서 뒤 몇 낱말 안에서만 찾는다 — 멀리서 찾으면 흔한 낱말에 엉뚱하게 튄다
 *   - 그래도 못 찾으면 두 낱말이 연달아 맞는 곳을 본문 전체에서 찾는다 —
 *     중간 쪽부터 읽기 시작하거나 앞으로 돌아가 다시 읽는 경우다
 *
 * 순수 함수만 둔다. 음성 인식은 useReadAloud 가, 색칠은 LibraryScreen 이 한다.
 */

/** 본문과 같은 규칙으로 낱말을 나눈다 (LibraryScreen 의 TOKEN_PATTERN) */
export const TOKEN_PATTERN = /([\s.,!?~"'()[\]{}·…—-]+)/;

/** 커서 뒤로 이만큼 안에서 다음 낱말을 찾는다 */
export const WINDOW = 8;

/** 부호·공백을 지우고 비교한다. 음성 인식은 부호를 거의 안 찍는다 */
export function normalize(word: string): string {
  return word.replace(/[^\p{L}\p{N}]/gu, "");
}

/** 본문이나 들린 문장을 낱말 목록으로 */
export function splitWords(text: string): string[] {
  return text
    .split(TOKEN_PATTERN)
    .filter((part) => part && !TOKEN_PATTERN.test(part))
    .map((part) => part.trim())
    .filter(Boolean);
}

/**
 * 같은 낱말인가. 한쪽이 다른 쪽으로 시작하면 같다고 본다 — 한국어는 조사가 붙고
 * 떨어지는 차이가 대부분이다. 한 글자짜리는 앞머리 비교를 하지 않는다 ("그" 가
 * "그러나" 와 같다고 하면 아무 데나 맞는다).
 */
export function sameWord(book: string, heard: string): boolean {
  const a = normalize(book);
  const b = normalize(heard);
  if (!a || !b) return false;
  if (a === b) return true;
  if (Math.min(a.length, b.length) < 2) return false;
  return a.startsWith(b) || b.startsWith(a) || a.endsWith(b);
}

/**
 * 한글 음절을 자모로 편다 ("해" → ㅎ ㅐ). 음절 단위로 재면 한 글자짜리 말끼리는
 * 전부 "한 글자 차이" 라 "해" 가 "펑" 과도 비슷해진다. 자모로 재면 "해 ↔ 회" 는
 * 한 자 차이, "해 ↔ 펑" 은 세 자 차이로 갈린다.
 */
function jamo(word: string): string[] {
  const out: string[] = [];
  for (const ch of word) {
    const code = ch.codePointAt(0) ?? 0;
    if (code < 0xac00 || code > 0xd7a3) {
      out.push(ch);
      continue;
    }
    const s = code - 0xac00;
    out.push(`L${Math.floor(s / 588)}`, `V${Math.floor((s % 588) / 28)}`);
    if (s % 28) out.push(`T${s % 28}`);
  }
  return out;
}

/** 자모 단위 편집 거리 */
function distance(a: string, b: string): number {
  const x = jamo(a);
  const y = jamo(b);
  let prev = Array.from({ length: y.length + 1 }, (_, j) => j);
  for (let i = 1; i <= x.length; i += 1) {
    const row = [i];
    for (let j = 1; j <= y.length; j += 1) {
      row[j] = Math.min(prev[j] + 1, row[j - 1] + 1, prev[j - 1] + (x[i - 1] === y[j - 1] ? 0 : 1));
    }
    prev = row;
  }
  return prev[y.length];
}

/**
 * 비슷한 낱말인가 — 자모로 폈을 때 긴 쪽의 40% 까지 (짧아도 한 자는) 달라도 된다.
 * 한쪽이 다른 쪽으로 시작하면 한 글자짜리도 받는다 ("흰" ↔ "흰색", "추운" ↔ "추").
 * "추운 겨울날이었습니다" 를 "추 결말이었습니다" 로 들어도 따라간다.
 * **바로 다음 한두 낱말에만** 쓴다 (findNear) — 넓게 쓰면 짧은 말이 아무 데나 맞는다
 */
export function similarWord(book: string, heard: string): boolean {
  const a = normalize(book);
  const b = normalize(heard);
  if (!a || !b) return false;
  if (a.startsWith(b) || b.startsWith(a)) return true;
  const longest = Math.max(jamo(a).length, jamo(b).length);
  return distance(a, b) <= Math.max(1, Math.floor(longest * 0.4));
}

/** 비슷하기만 해도 받는 범위 — 커서 바로 다음 낱말과 그다음 하나 */
const FUZZY_REACH = 2;

/** 커서부터 WINDOW 안에서 들린 낱말 하나를 찾는다. 찾으면 그 낱말 **다음** 위치 */
function findNear(words: string[], cursor: number, heard: string): number {
  const end = Math.min(words.length, cursor + WINDOW);
  for (let j = cursor; j < end; j += 1) {
    if (sameWord(words[j], heard)) return j + 1;
  }
  // 붙어서 들린 말 — 본문 두 낱말을 이어 붙여 본다
  for (let j = cursor; j + 1 < end; j += 1) {
    if (sameWord(words[j] + words[j + 1], heard)) return j + 2;
  }
  // 잘못 들린 말 — 바로 다음 한두 낱말만 비슷한지 본다
  for (let j = cursor; j < Math.min(words.length, cursor + FUZZY_REACH); j += 1) {
    if (similarWord(words[j], heard)) return j + 1;
  }
  return -1;
}

/**
 * 두 낱말이 연달아 맞는 곳을 본문 전체에서 찾는다. 지금 커서에서 가까운 앞쪽을
 * 먼저 보고, 없으면 처음부터 본다 (앞으로 돌아가 다시 읽는 경우).
 *
 * 돌려주는 것: 맞은 두 낱말 **다음** 본문 위치와, 들린 말 중 몇 개를 썼는지.
 * 들린 말의 첫 쌍이 잡음이고 둘째 쌍에서 맞을 수도 있어서 둘 다 필요하다.
 */
function anchor(
  words: string[],
  cursor: number,
  heard: string[],
): { next: number; used: number } | null {
  const order = [
    ...Array.from({ length: Math.max(0, words.length - cursor) }, (_, k) => cursor + k),
    ...Array.from({ length: Math.min(cursor, words.length) }, (_, k) => k),
  ];
  for (let h = 0; h + 1 < heard.length; h += 1) {
    for (const j of order) {
      if (
        j + 1 < words.length &&
        sameWord(words[j], heard[h]) &&
        sameWord(words[j + 1], heard[h + 1])
      ) {
        return { next: j + 2, used: h + 2 };
      }
    }
  }
  return null;
}

/**
 * 들린 낱말들로 커서를 옮긴다. 커서 = 지금까지 읽은 본문 낱말 수.
 *
 * 한 번 들어온 말 중 아무것도 가까이서 못 찾으면 전체에서 닻을 내린다.
 * 둘 다 실패하면 커서는 그대로다 — 잡음이나 딴말이다.
 */
export function advance(words: string[], cursor: number, heard: string[]): number {
  let next = cursor;
  let matched = false;
  for (const word of heard) {
    const found = findNear(words, next, word);
    if (found >= 0) {
      next = found;
      matched = true;
    }
  }
  if (matched || heard.length < 2) return next;

  const hit = anchor(words, cursor, heard);
  if (!hit) return cursor;
  // 닻을 내린 뒤 남은 말로 조금 더 따라간다
  const rest = heard.slice(hit.used);
  return rest.length ? advance(words, hit.next, rest) : hit.next;
}
