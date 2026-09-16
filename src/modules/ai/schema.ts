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
 * AI #2b 핵심 문장 고르기 (#14). 빈틈이 0개일 때만 부른다.
 *
 * 모델은 quote·reason 만 돌려준다. type("core_claim")은 pickCoreClaim 이 붙인다 —
 * 빈틈 분석의 3종 enum 에 넣으면 모델이 빈틈 대신 그걸 고르기 시작한다.
 */
export const coreClaimSchema = z.object({
  /** 독후감에 그대로 있는 문장 하나. 요약·윤문 금지 */
  quote: z.string().min(1),
  /** 학생에게 보여줄 한 문장. 빈틈이 없었다는 것과 이 문장을 더 듣고 싶다는 뜻 */
  reason: z.string().min(1),
});

export type CoreClaimOutput = z.infer<typeof coreClaimSchema>;

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
 * 앱이 쓰는 고정 장르 태그 (docs/prompts.md §5).
 *
 * ai 모듈이 이 목록의 주인이다. 여기 없는 값이 books.tags 에 들어가면
 * 문민재의 장르 도장판(genre_stamps.genre)이 모르는 장르를 받게 된다.
 * DB 는 text[] 라 제약이 없으므로 이 상수가 사실상의 계약이다.
 * 다른 모듈은 @/modules/ai 에서 가져다 쓴다.
 */
export const GENRE_TAGS = [
  "성장소설",
  "판타지",
  "SF",
  "추리",
  "동화",
  "역사",
  "과학",
  "모험",
  "우정",
  "인물심리",
  "가족",
  "사회",
  "자연",
  "예술",
  "고전",
] as const;

export type GenreTag = (typeof GENRE_TAGS)[number];

/**
 * 프롬프트 #5 장르 태그 정규화. 사용자에게 안 보이는 배치 작업이라 공유 타입이 없다.
 *
 * enum 으로 두면 JSON Schema 로 변환될 때 값 목록이 그대로 넘어가, 벤더가
 * 없는 태그를 만들지 못하게 막는다. 그래도 코드에서 한 번 더 거른다 (CLAUDE.md §6).
 * 개수 상한(4개)은 스키마로 막지 않는다 — 5개 왔다고 통째로 버리고 재시도하면
 * 지연만 늘어난다. 잘라 쓰는 쪽이 낫다.
 */
export const genreTagsSchema = z.object({
  tags: z.array(z.enum(GENRE_TAGS)),
});

export type GenreTagsResult = z.infer<typeof genreTagsSchema>;
