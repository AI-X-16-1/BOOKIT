/**
 * ai/server/prompts — 프롬프트 원문. owner: 강민구
 *
 * 원본은 docs/prompts.md 다. 여기 있는 문자열은 그 문서를 코드로 옮긴 것이고,
 * 한쪽만 고치면 안 된다. 프롬프트를 바꾸면 문서도 같이 바꾼다.
 *
 * system 에는 역할과 규칙(요청마다 안 변하는 것), user 에는 데이터를 넣는다.
 * 나중에 프롬프트 캐싱을 켤 때 이 경계가 그대로 캐시 경계가 된다.
 */
import "server-only";

import type { GradeLevel } from "@/shared/types";
import type { BookContext, Gap } from "@/shared/types";

/**
 * 프롬프트가 요구하지만 shared/types 의 함수 시그니처에는 없는 값들.
 *
 * docs/prompts.md 는 모든 호출에 grade_level 과 줄거리를 넘긴다고 적혀 있는데
 * AnalyzeGaps·BuildQuestion 타입에는 그 자리가 없다. 계약을 깨지 않으려고
 * 선택 인자로 받는다 — 없으면 학년 문구를 빼고, 줄거리는 모델 자체 지식에 맡긴다.
 *
 * src/shared/types 는 김민경 소유라 임의로 고치지 않는다 (CLAUDE.md §2).
 */
export interface PromptContext {
  gradeLevel?: GradeLevel;
  /** 유명하지 않은 책이면 API 책소개 텍스트를 넣는다 (docs/prompts.md §0). */
  synopsis?: string;
  /** 재시도 때 넘긴다. 여기 있는 질문과 같은 질문을 다시 내지 않는다. */
  avoidQuestions?: string[];
}

function gradeLine(context: PromptContext | undefined): string {
  return context?.gradeLevel ? `학년: ${context.gradeLevel}학년 / ` : "";
}

/* ── AI #2 빈틈 분석 ───────────────────────────────── */

export const GAP_ANALYSIS_SYSTEM = `너는 학생의 독후감을 읽고 '논리의 빈틈'을 찾는 분석기다.

책의 실제 내용과 대조해, 아래 세 유형에 해당하는 문장을 최대 3개 찾아라.

- unsupported_claim (근거 없이 단정): 판단이나 결론을 말하지만 어느 장면을 근거로 했는지 없음
- vague_statement (뭉뚱그린 문장): "여러 사건이 있었다"처럼 무엇인지 특정되지 않음
- feeling_only (감상만 남음): "감동적이었다"처럼 인물이나 장면과의 연결이 없음

규칙:
- quote는 독후감에 그대로 있는 문장을 글자 그대로 옮겨라. 요약하거나 다듬지 마라.
- 맞춤법이나 문장력을 지적하지 마라. 근거의 유무만 본다.
- 잘 쓴 독후감이면 빈틈이 0개일 수 있다. 억지로 채우지 마라.
- reason은 학생에게 보여줄 문장이다. 반말로 짧게, 나무라지 말고 사실만.`;

export function gapAnalysisUser(
  review: string,
  book: BookContext,
  context?: PromptContext,
): string {
  const synopsis = context?.synopsis
    ? `줄거리: ${context.synopsis}\n`
    : "줄거리: (제공되지 않음 — 네가 아는 내용을 쓰되, 모르는 책이면 독후감 안에서만 판단해라)\n";

  return `${gradeLine(context)}책: ${book.title} (${book.author})
${synopsis}
독후감:
"""${review}"""`;
}

/* ── AI #3 질문 생성 ───────────────────────────────── */

export const QUESTION_SYSTEM = `너는 학생이 쓴 독후감을 읽고 되묻는 역할이다.

학생이 쓴 문장을 인용해서, 왜 그렇게 생각했는지 되묻는 질문 한 개를 만들어라.

규칙:
- 해석·근거형 질문만. "어느 장면에서", "왜 그렇게 느꼈는지"를 묻는다.
- 등장인물 이름이나 지엽적 사실을 묻지 마라. 읽었어도 잊을 수 있다.
- "만약 ~라면" 가정형을 묻지 마라. 채점 기준을 세울 수 없다.
- 반말로 한 문장. 30초 안에 답할 수 있는 크기여야 한다.
- 답을 유도하거나 힌트를 주지 마라.`;

export function questionUser(
  gap: Gap,
  review: string,
  book?: BookContext,
  context?: PromptContext,
): string {
  const bookLine = book ? `책: ${book.title}\n` : "";

  // 재시도는 반드시 새 질문이어야 한다 (CLAUDE.md §6). 같은 빈틈밖에 없을 때를 대비해
  // 이전 질문을 그대로 넘겨 각도를 바꾸게 한다.
  const avoid = context?.avoidQuestions?.length
    ? `\n\n이미 물어본 질문이다. 절대 같은 질문을 다시 하지 마라. 같은 문장이라도 다른 각도로 물어라:\n${context.avoidQuestions
        .map((question) => `- ${question}`)
        .join("\n")}`
    : "";

  return `${gradeLine(context)}${bookLine}
학생이 쓴 문장: "${gap.quote}"
이 문장의 문제: ${gap.reason}

독후감 전문(맥락 참고용):
"""${review}"""${avoid}`;
}
