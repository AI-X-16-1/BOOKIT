/**
 * ai/server/writing-helper — AI #1 글쓰기 도우미. owner: 강민구
 *
 * 독후감을 쓰기 전에 길잡이 질문 하나를 준다. 빈 화면 앞에서 얼어붙지 않게 하는 게 목적이다.
 *
 * 네 호출 중 유일하게 채점과 무관하다. 실패해도 서비스가 죽지 않는다 —
 * 호출부는 이 함수가 던지면 도우미 없이 작성 화면을 그대로 띄워야 한다.
 * 힌트 하나 때문에 독후감을 못 쓰게 만들 이유가 없다.
 */
import "server-only";

import type { BookContext, GradeLevel, WritingHelperResult } from "@/shared/types";

import { questionSchema } from "../schema";
import { callJson } from "./llm";
import { WRITING_HELPER_SYSTEM, writingHelperUser } from "./prompts";

/**
 * 책 하나에 대해 길잡이 질문 한 개를 만든다.
 *
 * 학생이 작성 화면에서 기다리는 호출이라 effort 를 낮게 잡는다.
 * 줄거리 요약을 시키지 않고 장면과 감정을 떠올리게 하는 질문이 나와야 한다
 * (docs/prompts.md §1).
 */
export async function writingHelper(
  book: BookContext,
  grade: GradeLevel,
): Promise<WritingHelperResult> {
  const { question } = await callJson({
    label: "writing-helper",
    schema: questionSchema,
    system: WRITING_HELPER_SYSTEM,
    user: writingHelperUser(book, grade),
    effort: "low",
    // 한두 문장이지만 사고 토큰이 maxOutputTokens 에 함께 잡힌다 (providers.ts, issue #36).
    maxTokens: 2048,
    // 작성 화면에서 기다리는 시간이다. 오래 끌 바에는 도우미 없이 시작하는 게 낫다.
    timeoutMs: 12_000,
  });

  return { question: question.trim() };
}
