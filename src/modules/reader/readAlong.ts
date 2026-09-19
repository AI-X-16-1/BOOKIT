/**
 * reader/readAlong — 소리 내어 읽은 말을 본문 낱말에 맞춘다. owner: 강민구
 *
 * 9/18 마감 스프린트 ③ STT 낭독 하이라이트 (docs/sprint-0918.md, 기획 §3).
 * 아이가 읽는 대로 본문에 형광펜이 따라가는 노래방식 연출이다 (구글 Read Along 처럼).
 *
 * **판정이 아니라 시각 효과다.** 그래서 틀려도 된다 — 몇 낱말 놓쳐도 뒤에서 다시
 * 맞으면 따라잡으면 된다. 이 파일의 규칙이 느슨한 이유가 그것이다:
 *   - 조사가 달라도 같은 낱말로 본다 ("소녀" 와 "소녀가")
 *   - 앞이 잘려 들린 말도 받는다 ("같이" 와 본문의 "날개같이")
 *   - 붙어서 들린 말도 받는다 ("할수있다" 와 본문의 "할 수 있다")
 *   - **바로 다음 한두 낱말**은 비슷하기만 해도 받는다 — 실제 인식이 "해 → 회",
 *     "흰 → 흰색", "희고도 → 이고도" 로 들었다 (2026-09-18 크롬 실측, readAlong.test.ts).
 *     멀리 있는 낱말에는 쓰지 않는다. 짧은 말끼리는 대부분 한 글자 차이라 아무 데나 맞는다
 *   - **건너뛰면 따라가지 않는다.** 다음 낱말은 커서에서 세 낱말 안에서만 찾는다 —
 *     인식기가 짧은 말 서너 개를 흘리는 건 받아 주지만(실측에서 "흰 새의 날개같이" 를
 *     한 번에 흘렸다가 나중에 고쳐 보냈다),
 *     문장을 건너뛰면 형광펜은 거기서 기다린다. 형광펜 끝이 "여기부터 다시 읽어" 다.
 *     (폰 실기기 피드백, 2026-09-18: 많이 건너뛰어 읽었는데 그대로 진행됐다)
 *   - **커서는 절대 뒤로 가지 않는다.** 안드로이드 크롬은 들은 말을 앞에서부터 쌓아
 *     다시 보내서, 이미 읽은 첫 문장이 또 들어오면 읽던 자리가 처음으로 돌아갔다
 *
 * 예전에는 가까이서 못 찾으면 몇 낱말이 연달아 맞는 곳으로 멀리 "닻을 내렸다".
 * 그게 곧 건너뛰기를 허용하는 길이라 없앴다.
 *
 * 순수 함수만 둔다. 음성 인식은 useReadAloud 가, 색칠은 LibraryScreen 이 한다.
 */

/** 본문과 같은 규칙으로 낱말을 나눈다 (LibraryScreen 의 TOKEN_PATTERN) */
export const TOKEN_PATTERN = /([\s.,!?~"'()[\]{}·…—-]+)/;

/**
 * 커서 뒤로 **소리 낼 수 있는 낱말** 이만큼 안에서 다음 낱말을 찾는다.
 * 4 = 바로 다음 낱말 + 그 뒤 셋. 곧 "인식기가 세 낱말까지 흘려도 따라가고, 그보다
 * 많이 건너뛰면 멈춘다" 는 뜻이다.
 *
 * 부호뿐인 낱말(「펑 ─ 펑」 의 ─)은 세지 않는다. 소리 낼 수 없는 칸이라, 세면
 * "펑펑 쏟아져" 를 읽어도 쏟아져가 멀리 있는 것처럼 보여 건너뛰기로 판정됐다 (실측)
 */
export const WINDOW = 4;

/**
 * 이번에 읽기 시작한 뒤 **아직 한 낱말도 못 맞췄을 때**만 쓰는 넓은 폭 — 첫 문장 하나.
 * 🎤 를 누르고 인식기가 실제로 듣기 시작하기까지 틈이 있어서(데스크톱 실측 0.2초,
 * 폰은 더 길다) 곧바로 읽기 시작하면 앞 낱말 몇 개를 흘린다. 그걸 건너뛰기로 보면
 * 처음에서 영영 멈춘다 (폰 실기기: TTS 로 틀었더니 처음부터 진행이 안 됐다)
 */
export const START_WINDOW = 12;

/** 소리 내어 읽을 수 있는 낱말인가 — 부호뿐인 칸(─ …)은 아니다 */
function readable(word: string): boolean {
  return normalize(word) !== "";
}

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


/**
 * 커서부터 소리 낼 수 있는 낱말 WINDOW 개 안에서 들린 낱말 하나를 찾는다.
 * 찾으면 그 낱말 **다음** 위치, 못 찾으면 -1
 */
function findNear(words: string[], cursor: number, heard: string, width: number): number {
  const near: number[] = [];
  for (let j = cursor; j < words.length && near.length < width; j += 1) {
    if (readable(words[j])) near.push(j);
  }
  for (const j of near) {
    if (sameWord(words[j], heard)) return j + 1;
  }
  // 붙어서 들린 말 — 이웃한 두 낱말을 이어 붙여 본다 (가운데 부호 칸은 건너서)
  for (let k = 0; k + 1 < near.length; k += 1) {
    if (sameWord(words[near[k]] + words[near[k + 1]], heard)) return near[k + 1] + 1;
  }
  // 잘못 들린 말 — 바로 다음 한두 낱말만 비슷한지 본다
  for (const j of near.slice(0, FUZZY_REACH)) {
    if (similarWord(words[j], heard)) return j + 1;
  }
  return -1;
}


/**
 * 들린 낱말들로 커서를 옮긴다. 커서 = 지금까지 읽은 본문 낱말 수.
 * 못 찾은 말은 건너뛴다 — 잡음이거나, 딴말이거나, 아이가 건너뛰고 읽은 곳이다.
 * 커서는 앞으로만 간다.
 */
export function advance(
  words: string[],
  cursor: number,
  heard: string[],
  /** 첫 낱말을 찾을 폭. 아직 하나도 못 맞췄으면 START_WINDOW 를 넘긴다 */
  firstWidth: number = WINDOW,
): number {
  let next = cursor;
  for (const word of heard) {
    const found = findNear(words, next, word, next === cursor ? firstWidth : WINDOW);
    if (found < 0) continue;
    next = found;
    // 맞춘 낱말 바로 뒤의 부호뿐인 칸(” ─ …)은 소리 낼 수 없으니 함께 넘긴다.
    // 넘기지 않으면 "다음에 읽을 칸" 이 부호를 가리켜, 쪽 끝이 ” 로 끝날 때 다음 쪽으로
    // 안 넘어갔다 (「참된 동정」 1쪽 끝: … 줍시요 ”)
    while (next < words.length && !readable(words[next])) next += 1;
  }
  return next;
}

/**
 * 한 번 켠 동안(세션)의 들은 말. 결과 목록을 앞에서부터 이어 붙이되, 뒤 결과가 앞 결과로
 * **시작하면** 앞 것을 버린다 — 안드로이드 크롬은 같은 말을 쌓아서 다시 보낸다
 * ("어느 해" → "어느 해 몹시" → "어느 해 몹시 추운").
 */
/** 음성 인식 결과 목록 중 여기서 쓰는 모양만 (lib.dom 의 SpeechRecognitionResultList 와 맞는다) */
export interface ResultListLike {
  readonly length: number;
  readonly [index: number]: {
    readonly isFinal: boolean;
    readonly [alternative: number]: { readonly transcript: string } | undefined;
  };
}

export function sessionText(results: ResultListLike, final: boolean): string {
  const parts: string[] = [];
  for (let i = 0; i < results.length; i += 1) {
    if (results[i].isFinal !== final) continue;
    const text = (results[i][0]?.transcript ?? "").trim();
    if (!text) continue;
    const last = parts[parts.length - 1];
    if (last !== undefined && text.startsWith(last)) parts[parts.length - 1] = text;
    else if (last === undefined || !last.startsWith(text)) parts.push(text);
  }
  return parts.join(" ");
}

/**
 * 본문에서 n 번째 낱말(0부터, splitWords 와 같은 번호)이 시작하는 글자 위치.
 * n 이 낱말 수 이상이면 본문 길이. 낱말 퀴즈가 "방금 읽은 대목" 을 자를 때 쓴다 —
 * 화면은 낱말 번호(data-word)만 알고, 서버는 원문을 문장부호째 잘라야 한다.
 *
 * 문단 사이 빈 줄도 구분자라, 화면처럼 문단별로 나눠 센 번호와 같다
 */
export function wordOffset(body: string, n: number): number {
  let at = 0;
  let count = 0;
  for (const part of body.split(TOKEN_PATTERN)) {
    if (part && !TOKEN_PATTERN.test(part) && part.trim()) {
      if (count === n) return at + (part.length - part.trimStart().length);
      count += 1;
    }
    at += part.length;
  }
  return body.length;
}
