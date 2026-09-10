/**
 * ai/server/question — AI #3 꼬리질문 생성. owner: 강민구
 *
 * 빈틈 하나를 받아 학생 본인 문장을 인용해 되묻는다.
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

  // 1회는 같은 질문이 나와도 다시 물어본다. 그래도 같으면 호출부가 판단하도록 던진다.
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    const { question } = await callJson({
      label: "question",
      schema: questionSchema,
      system: QUESTION_SYSTEM,
      user: questionUser(gap, review, book, context),
      // 질문 자체는 한 문장이지만 512 로는 잘린다 — Gemini 는 사고(thinking) 토큰이
      // maxOutputTokens 에 함께 잡힌다 (providers.ts 참고).
      maxTokens: 2048,
    });

    const asked = question.trim();
    if (!isRepeat(asked, avoid)) return { question: asked };

    console.warn(`[ai:question] 이전과 같은 질문이 나왔다. 다시 만든다: ${asked}`);
  }

  throw new LlmError(
    "invalid_output",
    "[question] 이전과 다른 질문을 만들지 못했다. 다른 빈틈으로 다시 시도해라.",
  );
}

/** 공백·문장부호 차이만 있는 것도 같은 질문으로 본다. */
function isRepeat(question: string, avoid: string[]): boolean {
  const key = normalize(question);
  return avoid.some((previous) => normalize(previous) === key);
}

function normalize(text: string): string {
  return text.replace(/\s+/g, "").replace(/[?!.,'"“”‘’]/g, "");
}
