/**
 * ai/server/level-test — AI #7 읽기 수준 진단. owner: 강민구 (파일은 박재경이 추가)
 *
 * 2026-09-18 추가 요청. 온보딩에서 학생이 고른 학년이 맞는지, 짧은 지문 하나로
 * 가늠해 **추천 학년**을 돌려준다. 점수도 합격도 없다 — 학생이 받아들일지 고른다.
 *
 * **기존 4 프롬프트(#1~#4)는 건드리지 않는다.** 체크포인트(#6)가 들어온 방식과 같이
 * 일곱 번째 프롬프트로 따로 있고, 검증 파이프라인·책갈피·RLS 와 겹치지 않는다.
 * 진단 결과는 어디에도 쌓지 않는다 — 학생이 받아들이면 profiles.grade_level 한 칸이
 * 바뀌는 것이 전부다 (새 표도 마이그레이션도 없다).
 *
 * 문항 생성과 판정이 한 파일에 있는 이유는 checkpoint.ts 와 같다 — 둘이 같은 지문을
 * 보고, 판정 기준이 문항 난이도 설계의 거울상이라 따로 두면 한쪽만 고쳐진다.
 */
import "server-only";

import { levelQuestionsSchema, levelResultSchema } from "../schema";
import type { LevelQuestions, LevelResult } from "../schema";
import { callJson } from "./llm";
import {
  LEVEL_JUDGE_SYSTEM,
  LEVEL_TEST_SYSTEM,
  levelJudgeUser,
  levelTestUser,
  type PassageContext,
} from "./prompts";

export type { PassageContext } from "./prompts";

/**
 * 지문 하나에서 난이도가 다른 세 문항.
 *
 * 한 번의 호출로 셋을 받는다 — 세 번 부르면 온보딩에서 기다리는 시간이 세 배가 되고,
 * 난이도를 나누는 일은 셋을 같이 봐야 된다.
 */
export async function buildLevelTest(
  passage: PassageContext,
  gradeLevel?: number,
): Promise<LevelQuestions> {
  const built = await callJson({
    label: "level-test",
    schema: levelQuestionsSchema,
    system: LEVEL_TEST_SYSTEM,
    user: levelTestUser(passage, gradeLevel),
    maxTokens: 4096,
  });

  // 쉬움 → 보통 → 어려움 순서로 내보낸다. 화면은 받은 순서대로 그린다
  return {
    questions: [built.easy, built.medium, built.hard].map((q) => q.trim()),
  };
}

/**
 * 답 셋을 보고 추천 학년.
 *
 * 빈 답이 와도 부른다 — 건너뛴 것도 정보다. 대신 프롬프트가 "빈 답으로 학년을
 * 내리지 말라" 고 못 박는다. 한 번 못 푼 것으로 아이의 책을 쉬운 쪽으로
 * 밀어 버리면, 진단이 아이를 돕는 게 아니라 가둔다.
 */
export async function judgeLevelTest(
  passage: PassageContext,
  questions: string[],
  answers: string[],
  gradeLevel?: number,
): Promise<LevelResult> {
  const result = await callJson({
    label: "level-judge",
    schema: levelResultSchema,
    system: LEVEL_JUDGE_SYSTEM,
    user: levelJudgeUser(passage, questions, answers, gradeLevel),
    maxTokens: 4096,
  });

  return {
    recommendedGrade: Number(result.recommended_grade),
    confidence: result.confidence,
    feedback: result.feedback.trim(),
  };
}
