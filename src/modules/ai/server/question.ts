/**
 * ai/server/question — AI #3 꼬리질문 생성. owner: 강민구
 *
 * 빈틈 하나를 받아 학생 본인 문장에 대해 되묻는다. 문장은 화면이 따로 보여주므로
 * 질문에는 옮겨 적지 않는다 (issue #27).
 * 대필과 부정행위가 무너지는 지점이라, 매 제출마다 새로 만든다 (CLAUDE.md §6).
 */
import "server-only";

import type { BookContext, BuildQuestionResult, Gap } from "@/shared/types";

import { questionSchema } from "../schema";
import { callJson, LlmError } from "./llm";
import { QUESTION_SYSTEM, questionUser, type PromptContext } from "./prompts";

/**
 * 빈틈 하나를 질문 한 개로 바꾼다.
 *
 * context.avoidQuestions 에 이전 질문을 넣으면 같은 질문이 다시 나오지 않는다.
 * 재작성 플로우에서는 반드시 넘겨야 한다 — 같은 질문을 다시 주면 부정행위
 * 방지가 통째로 무너진다 (CLAUDE.md §6).
 */
export async function buildQuestion(
  gap: Gap,
  review: string,
  book?: BookContext,
  context?: PromptContext,
): Promise<BuildQuestionResult> {
  const avoid = context?.avoidQuestions ?? [];
  let echoed: string | null = null;

  // 1회는 같은 질문이 나와도 다시 물어본다. 그래도 같으면 호출부가 판단하도록 던진다.
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    const { question } = await callJson({
      label: "question",
      schema: questionSchema,
      system: QUESTION_SYSTEM,
      user: questionUser(gap, review, book, context),
      // 질문 자체는 한 문장이지만 Gemini 는 사고(thinking) 토큰이 maxOutputTokens 에
      // 함께 잡힌다. flash 기본값에서 사고만 최대 1483 토큰을 썼다 (issue #36).
      maxTokens: 4096,
    });

    const asked = question.trim();
    if (isRepeat(asked, avoid)) {
      console.warn(`[ai:question] 이전과 같은 질문이 나왔다. 다시 만든다: ${asked}`);
      continue;
    }
    if (!echoesQuote(asked, gap.quote)) return { question: asked };

    // 학생 문장을 되풀이한 질문은 어색할 뿐 틀린 질문은 아니다. 한 번 더 만들어 보고
    // 그래도 되풀이하면 이걸 쓴다 — 질문을 못 내는 것보다 낫다.
    console.warn(`[ai:question] 학생 문장을 질문에 옮겨 적었다. 다시 만든다: ${asked}`);
    echoed = asked;
  }

  if (echoed) return { question: echoed };

  throw new LlmError(
    "invalid_output",
    "[question] 이전과 다른 질문을 만들지 못했다. 다른 빈틈으로 다시 시도해라.",
  );
}

/**
 * 학생 문장을 질문에 통째로 옮겨 적었는가 (issue #27).
 *
 * 질문 화면이 quote 를 "네가 쓴 문장" 칸에 따로 보여주므로 되풀이하면 같은 문장이
 * 두 번 보이고, 이어 붙이다 "…생각한다라고 했는데" 처럼 조사가 겹친다.
 * 핵심 낱말을 짚는 것은 괜찮으므로 긴 조각이 그대로 들어간 경우만 본다.
 */
const ECHO_CHARS = 12;

export function echoesQuote(question: string, quote: string): boolean {
  const asked = normalize(question);
  const source = normalize(quote);
  for (let start = 0; start + ECHO_CHARS <= source.length; start += 1) {
    if (asked.includes(source.slice(start, start + ECHO_CHARS))) return true;
  }
  return false;
}

/** 공백·문장부호 차이만 있는 것도 같은 질문으로 본다. */
function isRepeat(question: string, avoid: string[]): boolean {
  const key = normalize(question);
  return avoid.some((previous) => normalize(previous) === key);
}

function normalize(text: string): string {
  return text.replace(/\s+/g, "").replace(/[?!.,'"“”‘’]/g, "");
}
