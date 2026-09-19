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
 * AI #6 체크포인트 — 장 끝 한 문항 (docs/sprint-0918.md ③, spec §2b).
 *
 * 질문은 #1·#3 과 같은 모양이지만 같은 스키마를 돌려쓰지 않는다. 그쪽은
 * WritingHelperResult·BuildQuestionResult 계약에 묶여 있고, 체크포인트는
 * shared 에 계약이 없는 ai 모듈 내부 타입이다 (src/shared/types 는 김민경 소유).
 */
export const checkpointQuestionSchema = z.object({
  question: z.string().min(1),
});

/**
 * 체크포인트 판정. 채점(#4)의 3축이 아니라 통과 여부 하나다 —
 * 책갈피를 주지 않으므로 축을 나눠 보여줄 자리도 없다 (spec §2b).
 */
export const checkpointJudgeSchema = z.object({
  passed: z.boolean(),
  /** 아이에게 그대로 보여주는 반말 한두 문장 */
  feedback: z.string().min(1),
});

export interface CheckpointQuestion {
  question: string;
}

export interface CheckpointJudgement {
  passed: boolean;
  feedback: string;
}

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

/* ── 레벨테스트 (AI #7, 2026-09-18) ──────────────────── */

/**
 * 읽기 수준 진단 문항. 지문 하나에서 세 문항을 한 번에 받는다.
 *
 * 검증(#3)과 달리 **난이도를 나눠서** 묻는다 — 쉬운 것 하나, 보통 하나, 어려운 하나.
 * 그래야 답을 보고 위아래 어느 쪽으로 옮길지가 나온다. 하나만 물으면
 * "맞았다/틀렸다" 밖에 안 남는다.
 *
 * 배열이 아니라 **이름 붙인 세 칸**인 이유: Anthropic 의 structured output 은
 * `minItems` 가 0 이나 1 이 아니면 거절한다 (`z.array().min(3)` → 400
 * "For 'array' type, 'minItems' values other than 0 or 1 are not supported").
 * 개수를 스키마로 못 박는 대신 칸을 셋 두면 세 개가 오는 것이 보장되고,
 * 어느 칸이 어느 난이도인지도 이름으로 남는다. 개수 제약을 스키마에 넣지 않는 것은
 * genreTagsSchema 가 같은 이유로 택한 방식이다.
 */
export const levelQuestionsSchema = z.object({
  easy: z.string().min(1),
  medium: z.string().min(1),
  hard: z.string().min(1),
});

/**
 * 진단 결과.
 *
 * `recommended_grade` 는 1~9 (spec §1 의 grade_level 과 같은 눈금).
 * 점수가 아니라 **추천**이다 — 학생이 받아들일지 고른다. 합격·불합격이 없다.
 */
export const levelResultSchema = z.object({
  /**
   * 1~9 를 **문자열 enum** 으로 받는다. Anthropic 의 structured output 은
   * `integer` 에 `minimum`/`maximum` 을 지원하지 않는다 (400 "For 'integer' type,
   * properties maximum, minimum are not supported"). 범위를 못 박지 못하면 모델이
   * 0 이나 12 를 돌려줄 수 있고, 그 값이 그대로 grade_level 추천이 된다.
   * enum 으로 두면 값 목록이 JSON Schema 로 넘어가 애초에 다른 값이 나오지 않는다 —
   * GENRE_TAGS 와 같은 이유다. 코드에서 Number() 로 바꿔 쓴다.
   */
  recommended_grade: z.enum(["1", "2", "3", "4", "5", "6", "7", "8", "9"]),
  /** 낮으면 화면이 "그대로 둬도 좋아" 쪽으로 기운다 */
  confidence: z.enum(["low", "medium", "high"]),
  /** 아이에게 그대로 보여주는 반말 두세 문장. 잘한 점을 먼저 */
  feedback: z.string().min(1),
});

export interface LevelQuestions {
  questions: string[];
}

export interface LevelResult {
  recommendedGrade: number;
  confidence: "low" | "medium" | "high";
  feedback: string;
}

/**
 * AI #8 낱말 퀴즈 (2026-09-19) — 서재에서 읽는 도중(책의 25·50·75%)에 뜨는 미니게임.
 *
 * 보기를 배열이 아니라 칸 둘(`wrong1`·`wrong2`)로 받는다 — 벤더 JSON 스키마는 `array` 의
 * `minItems` 가 0·1 이 아니면 400 이다 (AI #7 에서 맞은 벽, docs/submission-ai.md §3 ⑦).
 * 정답 자리는 모델이 아니라 서버가 섞는다 — 모델은 정답을 늘 첫 칸에 두는 버릇이 있다
 */
export const wordQuizSchema = z.object({
  /** 지문에 **그대로** 나온 꼴. 서버가 지문에서 찾아보고 없으면 버린다 */
  word: z.string().min(1),
  /** 그 낱말이 든 문장 — 지문 그대로 */
  sentence: z.string().min(1),
  /** 그 문장에서의 뜻. 아이 말로 짧게 */
  meaning: z.string().min(1),
  wrong1: z.string().min(1),
  wrong2: z.string().min(1),
});

export interface WordQuiz {
  word: string;
  sentence: string;
  /** 보기 셋. 순서는 서버가 섞었다 */
  choices: [string, string, string];
  /** 정답 보기의 자리 (0~2) */
  answer: number;
}
