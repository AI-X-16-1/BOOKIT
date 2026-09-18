/**
 * reader/readAlong — 소리 내어 읽은 말을 본문 낱말에 맞춘다. owner: 강민구
 *
 * 9/18 마감 스프린트 ③ STT 낭독 하이라이트 (docs/sprint-0918.md, 기획 §3).
 * 아이가 읽는 대로 본문 색이 따라가는 노래방식 연출이다 (구글 Read Along 처럼).
 *
 * **판정이 아니라 시각 효과다.** 그래서 틀려도 된다 — 몇 낱말 놓쳐도 뒤에서 다시
 * 맞으면 따라잡으면 된다. 이 파일의 규칙이 느슨한 이유가 그것이다:
 *   - 조사가 달라도 같은 낱말로 본다 ("소녀" 와 "소녀가")
 *   - 붙어서 들린 말도 받는다 ("할수있다" 와 본문의 "할 수 있다")
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
  return a.startsWith(b) || b.startsWith(a);
}

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
