/**
 * ai/server/checkpoint — AI #6 체크포인트. owner: 강민구
 *
 * 9/18 마감 스프린트(docs/sprint-0918.md) ③ · spec §2b·§5b.
 * 한 장을 다 읽었을 때 그 장 본문으로 한 문항을 만들고, 답이 그 장을 읽은 답인지 본다.
 *
 * **기존 4 프롬프트는 건드리지 않는다** (스프린트 불변식). 여섯 번째 프롬프트로 따로 있고,
 * 검증 파이프라인과 데이터도 겹치지 않는다 — 책갈피도 주지 않는다.
 *
 * 질문 생성과 판정이 한 파일에 있는 이유: 둘이 같은 장 본문을 보고, 판정 기준이
 * 질문 규칙의 거울상이라 따로 두면 한쪽만 고쳐진다 (prompts.ts 의 두 SYSTEM 을 같이 읽어라).
 */
import "server-only";

import { checkpointJudgeSchema, checkpointQuestionSchema } from "../schema";
import type { CheckpointJudgement, CheckpointQuestion } from "../schema";
import { callJson } from "./llm";
import {
  CHECKPOINT_JUDGE_SYSTEM,
  CHECKPOINT_SYSTEM,
  checkpointJudgeUser,
  checkpointUser,
  type ChapterContext,
  type PromptContext,
} from "./prompts";

export type { ChapterContext } from "./prompts";

/**
 * 그 장으로 문항 하나.
 *
 * 매번 새로 만들지 않는다 — 같은 장에서 다시 물으면 라우트가 저장된 행을 그대로
 * 돌려준다 (0014 의 unique (student_id, book_id, chapter_no)). 검증과 달리 부정행위를
 * 막는 문이 아니라 읽기를 잇는 문이고, 다시 눌렀을 때 질문이 바뀌면 아이가 헷갈린다.
 */
export async function askCheckpoint(
  chapter: ChapterContext,
  context?: PromptContext,
): Promise<CheckpointQuestion> {
  const { question } = await callJson({
    label: "checkpoint",
    schema: checkpointQuestionSchema,
    system: CHECKPOINT_SYSTEM,
    user: checkpointUser(chapter, context),
    maxTokens: 4096,
  });

  return { question: question.trim() };
}

/** 그 장을 읽은 답인가. 통과 기준은 넉넉하다 — 기준은 CHECKPOINT_JUDGE_SYSTEM 에 적혀 있다 */
export async function judgeCheckpoint(
  chapter: ChapterContext,
  question: string,
  answer: string,
  context?: PromptContext,
): Promise<CheckpointJudgement> {
  const result = await callJson({
    label: "checkpoint-judge",
    schema: checkpointJudgeSchema,
    system: CHECKPOINT_JUDGE_SYSTEM,
    user: checkpointJudgeUser(chapter, question, answer, context),
    maxTokens: 4096,
  });

  return { passed: result.passed, feedback: result.feedback.trim() };
}
