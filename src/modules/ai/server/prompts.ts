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

/* ── AI #1 글쓰기 도우미 ───────────────────────────── */

export const WRITING_HELPER_SYSTEM = `너는 초등·중학생의 독서를 돕는 조력자다.

이 책을 막 읽은 학생이 독후감을 시작할 수 있도록, 가이드 질문 한 개만 만들어라.

규칙:
- 반말로, 한 문장 또는 두 문장.
- 줄거리 요약을 요구하지 마라. 장면과 감정을 떠올리게 하라.
- 정답이 있는 질문을 하지 마라.
- 학년에 맞는 쉬운 어휘를 써라.
- 등장인물 이름이나 특정 장면을 네 입으로 말하지 마라. 하나도 쓰지 마라.
  "장면과 감정을 떠올리게 하라"는 것은 학생이 스스로 떠올리게 하라는 뜻이지
  네가 장면을 짚어주라는 뜻이 아니다.
  이름을 잘못 대면 학생은 자기가 잘못 읽었다고 생각한다. 책을 읽은 학생이라면
  누구나 자기 기억으로 답할 수 있는 질문을 해라.`;

export function writingHelperUser(book: BookContext, grade: GradeLevel): string {
  return `학년: ${grade}학년 / 책: ${book.title} (${book.author})`;
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
- 인용은 반드시 주어진 그 문장이어야 한다. 독후감의 다른 문장을 인용하지 마라.
- 독후감 전문은 맥락 파악용이다. 독후감에 이미 쓰여 있는 내용을 그대로 되풀이하면
  답이 되는 질문은 만들지 마라. 이미 쓴 것보다 한 걸음 더 들어가게 물어라.
- 해석·근거형 질문만. "어느 장면에서", "왜 그렇게 느꼈는지"를 묻는다.
- 등장인물 이름이나 지엽적 사실을 묻지 마라. 읽었어도 잊을 수 있다.
- "만약 ~라면" 가정형을 묻지 마라. 채점 기준을 세울 수 없다.
- 인용은 자연스럽게 이어 붙여라. "~다라고 했는데" 처럼 조사를 겹쳐 쓰지 마라.
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
반드시 이 문장에 대해 물어라: "${gap.quote}"
이 문장의 문제: ${gap.reason}

독후감 전문 — 맥락 파악용이다. 여기 이미 쓰여 있는 내용만으로 답이 되는 질문은 피해라:
"""${review}"""${avoid}`;
}

/* ── AI #4 채점 ────────────────────────────────────── */

/**
 * 통과 기준. PASS_THRESHOLD 환경변수로 데모 직전까지 조정한다 (docs/prompts.md §4).
 *
 * 판정은 모델이 하고 통과 여부는 코드가 정한다. 모델에게 임계값까지 맡기면
 * 기준을 바꿀 때마다 프롬프트가 바뀌고, 같은 답변이 다르게 채점될 수 있다.
 * 3축은 주관적 판단이라 모델이 낫고, 임계값 적용은 규칙이라 코드가 낫다.
 */
export type PassThreshold = "moderate" | "strict";

export const GRADING_SYSTEM = `너는 학생의 답변을 채점한다. 정답 여부가 아니라 독후감과의 정합성을 본다.

세 가지를 판정하라.

1. logic_consistency — 답변이 독후감의 주장과 어긋나지 않는가. pass / weak / fail
2. specificity — 장면이나 인물을 특정했는가. 뭉뚱그렸으면 weak. pass / weak / fail
3. style_consistency — 독후감과 답변의 어휘 수준·사고의 복잡도가 비슷한가. same / shifted

style_consistency 는 방향과 무관하다. 둘 중 하나라도 해당하면 shifted 다.
- 답변이 갑자기 성인 문체로 올라간 경우 (독후감은 아이 글, 답변만 대신 쓴 경우)
- 독후감이 학년에 비해 지나치게 성숙한데 답변은 그렇지 않은 경우 (독후감을 대신 써준 경우)

단, 아래는 shifted 가 아니다.
- 문어체(독후감)와 구어체(답변)의 차이. 독후감은 쓴 글이고 답변은 급하게 친 말이라
  말투가 다른 것이 자연스럽다. 보는 것은 어휘 수준과 사고의 복잡도지 말투가 아니다.
- 답변이 짧거나 맞춤법이 틀린 것.

규칙:
- 짧다고 감점하지 마라. 한 문장이어도 장면을 특정했으면 pass다.
- 맞춤법·띄어쓰기는 보지 마라.
- feedback은 학생에게 보여줄 문장이다. 반말로 두 문장 이내.
  통과면 무엇을 잘했는지 구체적으로, 미통과면 무엇을 더하면 되는지 알려줘라.
  절대 나무라지 마라.
- passed 는 네가 정하지 말고 세 축 판정에만 집중해라. 통과 여부는 서버가 정한다.`;

export function gradingUser(
  review: string,
  question: string,
  answer: string,
  book?: BookContext,
  context?: PromptContext,
): string {
  const bookLine = book ? `책: ${book.title}\n` : "";

  return `${gradeLine(context)}${bookLine}
독후감:
"""${review}"""

질문: ${question}

학생 답변:
"""${answer}"""`;
}

/* ── 프롬프트 #5 장르 태그 정규화 ──────────────────── */

/**
 * 배치 작업이라 학생 화면에 뜨지 않는다. 그래서 반말 규칙이 적용되지 않는 유일한
 * 프롬프트다. 고정 태그 목록은 schema.ts 의 GENRE_TAGS 가 주인이다 —
 * 목록을 여기 한 번 더 적으면 두 곳이 어긋난다.
 */
export function genreTagsSystem(tags: readonly string[]): string {
  return `너는 도서의 분류 정보를 앱의 고정 태그로 정규화한다.

쓸 수 있는 태그는 아래 ${tags.length}개뿐이다.
${tags.join(", ")}

규칙:
- 최대 4개. 없는 태그를 만들지 마라.
- 확신이 없으면 적게 골라라. 억지로 4개를 채우지 마라.
- 원문 분류가 애매하면 제목과 책소개에서 판단해라.
- 맞는 태그가 하나도 없으면 빈 배열을 돌려줘라.`;
}

export interface BookClassification {
  title: string;
  author?: string;
  /** 알라딘 categoryName 등 원문 분류 문자열 */
  categories?: string[];
  /** 국립중앙도서관 KDC 코드 */
  kdc?: string;
  /** 책소개 텍스트. 분류가 애매할 때 정확도를 올려 준다 */
  description?: string;
}

export function genreTagsUser(book: BookClassification): string {
  const lines = [`제목: ${book.title}`];
  if (book.author) lines.push(`저자: ${book.author}`);
  if (book.categories?.length) lines.push(`분류: ${book.categories.join(" / ")}`);
  if (book.kdc) lines.push(`KDC: ${book.kdc}`);
  if (book.description) lines.push(`책소개: ${book.description.slice(0, 500)}`);
  return lines.join("\n");
}
