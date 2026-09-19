/**
 * ai/server/word-quiz — AI #8 낱말 퀴즈. owner: 강민구
 *
 * 서재에서 읽는 도중(책의 25·50·75%, 짧은 책은 50% 한 번)에 뜨는 미니게임 한 문제.
 * 기획 §4-1 의 어휘 문제를 버프·책갈피 없이 넣었다 — prompts.ts 의 WORD_QUIZ_SYSTEM 머리말.
 *
 * 채점은 서버도 모델도 하지 않는다. 정답 자리를 함께 내려보내고 화면이 바로 맞춘다 —
 * 걸린 것이 없는 놀이라 숨길 이유가 없고, 탭 한 번에 답이 나와야 읽는 흐름이 안 끊긴다.
 */
import "server-only";

import { wordQuizSchema, type WordQuiz } from "../schema";
import { callJson } from "./llm";
import { WORD_QUIZ_SYSTEM, wordQuizUser, type PromptContext } from "./prompts";

/** 공백을 한 칸으로 */
function squash(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

/** 문장이 끝나는 부호. 닫는 따옴표는 문장에 붙여 둔다 */
const SENTENCE_END = /[.!?。]/;
/** 낱말까지가 이보다 짧으면 앞 문장을 붙인다 */
const SENTENCE_MIN = 15;
/** 보여줄 문장 길이 상한 — 넘으면 낱말 앞뒤만 남기고 … 로 줄인다 */
const SENTENCE_MAX = 90;

/**
 * 지문에서 그 낱말이 든 문장을 **원문 그대로** 잘라 온다.
 *
 * 모델이 옮겨 적은 문장(sentence)은 쓰지 않는다 — 따옴표 모양(“ ↔ ")이나 띄어쓰기를
 * 바꿔 적는 일이 잦아 원문과 맞춰 보면 멀쩡한 문제가 버려졌다 (「참된 동정」 실측).
 * 모델 문장은 "지문의 어느 자리인가" 를 찾는 데만 쓴다 — 같은 낱말이 두 번 나오면
 * 모델이 가리킨 쪽을 고른다
 */
export function sentenceAround(passage: string, word: string, hint = ""): string | null {
  const text = squash(passage);
  const near = squash(hint).slice(0, 12);
  const hinted = near ? text.indexOf(near) : -1;
  let at = hinted >= 0 ? text.indexOf(word, hinted) : -1;
  if (at < 0) at = text.indexOf(word);
  if (at < 0) return null;

  let from = at;
  while (from > 0 && !SENTENCE_END.test(text[from - 1])) from -= 1;
  // "…” 하고 탄식을 하였습니다." 처럼 짧게 끊기면 뜻을 짐작할 앞말이 없다 — 앞 문장까지 붙인다
  if (at + word.length - from < SENTENCE_MIN && from > 0) {
    from -= 1;
    while (from > 0 && /[”’"')\s]/.test(text[from - 1])) from -= 1;
    while (from > 0 && !SENTENCE_END.test(text[from - 1])) from -= 1;
    // 따옴표 안의 ! ? 에서 끊겼으면 여는 따옴표까지 간다 — “돈 한 푼 줍시요! 돈 한 푼 줍시요!”
    const inside = text.slice(from, at);
    const open = text.lastIndexOf("“", from);
    if ((inside.match(/”/g)?.length ?? 0) > (inside.match(/“/g)?.length ?? 0) && open >= 0) {
      from = open;
    }
  }
  let to = at + word.length;
  while (to < text.length && !SENTENCE_END.test(text[to])) to += 1;
  to = Math.min(text.length, to + 1);
  // 문장 끝 바로 뒤의 닫는 따옴표는 문장에 붙인다
  while (to < text.length && /[”’"')]/.test(text[to])) to += 1;

  let sentence = text.slice(from, to).trim().replace(/^[”’"')\s]+/, "");
  if (sentence.length > SENTENCE_MAX) {
    const start = Math.max(0, sentence.indexOf(word) - 35);
    const cut = sentence.slice(start, start + SENTENCE_MAX);
    sentence = `${start > 0 ? "…" : ""}${cut}${start + SENTENCE_MAX < sentence.length ? "…" : ""}`;
  }
  return sentence.includes(word) ? sentence : null;
}

/**
 * 방금 읽은 대목으로 퀴즈 한 문제. 쓸 수 없는 문제면 null — 화면은 그냥 넘어간다.
 *
 * 버리는 경우: 낱말이 대목에 그대로 없다(모델이 활용형을 바꾸거나 지어냄) · 보기 셋 중
 * 같은 것이 있다. 문장은 서버가 원문에서 잘라 온다 (sentenceAround). 본문에 없는 낱말을 물으면
 * 아이가 앞 쪽으로 돌아가 찾아볼 수도, 눌러서 사전을 볼 수도 없다
 */
export async function makeWordQuiz(
  bookTitle: string,
  passage: string,
  context?: PromptContext,
  /** 이 책에서 이미 물어본 낱말 — 같은 낱말을 또 내지 않는다 */
  avoid: string[] = [],
  /** 섞기 — 테스트에서 고정한다 */
  random: () => number = Math.random,
): Promise<WordQuiz | null> {
  // 프롬프트로 막아도 모델이 같은 낱말을 또 고를 때가 있다 — 한 번만 다시 묻는다
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const quiz = await makeOnce(bookTitle, passage, context, avoid, random);
    if (quiz === null) return null;
    if (!alreadyAsked(quiz.word, avoid)) return quiz;
  }
  return null;
}

/**
 * 이미 물어본 낱말인가. 활용형이 달라도 같은 낱말이다 — "애걸애걸하는" 과 "애걸애걸하며".
 * 두 낱말의 앞 두 글자 이상이 겹치고 한쪽이 다른 쪽의 앞머리(끝 한 글자 뺀)로 시작하면 같다고 본다
 */
export function alreadyAsked(word: string, avoid: string[]): boolean {
  return avoid.some((asked) => {
    if (asked === word) return true;
    const a = asked.slice(0, Math.max(2, asked.length - 1));
    const b = word.slice(0, Math.max(2, word.length - 1));
    return word.startsWith(a) || asked.startsWith(b);
  });
}

async function makeOnce(
  bookTitle: string,
  passage: string,
  context: PromptContext | undefined,
  avoid: string[],
  random: () => number,
): Promise<WordQuiz | null> {
  const result = await callJson({
    label: "word-quiz",
    schema: wordQuizSchema,
    system: WORD_QUIZ_SYSTEM,
    user: wordQuizUser(bookTitle, passage, context, avoid),
    maxTokens: 4096,
  });

  const word = result.word.trim();
  const options = [result.meaning, result.wrong1, result.wrong2].map((choice) => choice.trim());

  if (word.length < 2) return null;
  const sentence = sentenceAround(passage, word, result.sentence);
  if (!sentence) return null;
  if (new Set(options).size !== 3 || options.some((choice) => !choice)) return null;

  // 정답 자리를 섞는다 (Fisher–Yates). 정답은 처음에 0번이다
  const order = [0, 1, 2];
  for (let i = order.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }

  return {
    word,
    sentence,
    choices: [options[order[0]], options[order[1]], options[order[2]]],
    answer: order.indexOf(0),
  };
}
