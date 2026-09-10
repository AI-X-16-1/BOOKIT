/**
 * ai — 런타임 스키마. owner: 강민구
 *
 * 여기 있는 zod 스키마는 두 가지 일을 한다.
 *
 * 1. 요청할 때  — zodOutputFormat 으로 JSON Schema 가 되어 모델 출력을 서버에서 강제한다.
 * 2. 받을 때    — 돌아온 값을 실제로 검증한다. 구조화 출력이 켜져 있어도 형태를 신뢰하지
 *                않는다는 규칙(CLAUDE.md §6)은 그대로다.
 *
 * 각 스키마는 `z.ZodType<공유타입>` 으로 못 박아 둔다. src/shared/types/ai.ts 의 계약과
 * 어긋나면 여기서 컴파일이 깨진다 — 프롬프트 출력 모양이 바뀌면 반드시 같이 고쳐야 한다.
 */
import { z } from "zod";

import type {
  AnalyzeGapsResult,
  BuildQuestionResult,
  GradeResult,
  WritingHelperResult,
} from "@/shared/types";

/** AI #1 글쓰기 도우미 · AI #3 질문 생성 — 둘 다 질문 한 개만 돌려준다. */
export const questionSchema: z.ZodType<WritingHelperResult & BuildQuestionResult> =
  z.object({
    question: z.string().min(1),
  });

export const gapSchema = z.object({
  /** 독후감에 그대로 있는 문장. 요약·윤문 금지 (docs/prompts.md §2) */
  quote: z.string().min(1),
  type: z.enum(["unsupported_claim", "vague_statement", "feeling_only"]),
  reason: z.string().min(1),
});

/**
 * AI #2 빈틈 분석.
 *
 * 개수 상한(3개)은 스키마로 막지 않는다. 4개가 왔다고 통째로 버리고 재시도하면
 * 지연만 늘어난다 — analyzeGaps 쪽에서 잘라 쓴다.
 * 잘 쓴 독후감이면 빈 배열이 정상이다.
 */
export const analyzeGapsSchema: z.ZodType<AnalyzeGapsResult> = z.object({
  gaps: z.array(gapSchema),
});

/** AI #4 채점. 맞고 틀림이 아니라 3개 축. */
export const gradeSchema: z.ZodType<GradeResult> = z.object({
  logic_consistency: z.enum(["pass", "weak", "fail"]),
  specificity: z.enum(["pass", "weak", "fail"]),
  style_consistency: z.enum(["same", "shifted"]),
  passed: z.boolean(),
  feedback: z.string().min(1),
});

/**
 * 프롬프트 #5 장르 태그 정규화. 사용자에게 안 보이는 배치 작업이라
 * 공유 타입이 없다. 고정 태그 목록 대조는 호출부에서 한다.
 */
export const genreTagsSchema = z.object({
  tags: z.array(z.string()),
});

export type GenreTagsResult = z.infer<typeof genreTagsSchema>;
