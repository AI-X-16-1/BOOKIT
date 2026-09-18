/**
 * API 계약 — docs/spec.md §5.
 *
 * 모든 라우트는 /api 아래. 보호자 라우트를 제외하고 전부 인증 필요.
 * 모든 응답은 { data } 또는 { error: { code, message } }.
 *
 * 소유: 김민경. 계약을 바꾸려면 spec.md 를 먼저 고친다 (CLAUDE.md §2).
 *
 * 중요: 교사·보호자 응답 타입에는 reviews.body 와 verifications.answer 에 해당하는
 * 필드가 아예 없다. 실수로 흘리는 걸 타입 단계에서 막는 게 목적이다 (CLAUDE.md §5).
 */

import type {
  Book,
  CharacterStage,
  Class,
  ExplorerRank,
  GapType,
  GradeLevel,
  PointReason,
  Profile,
  ProfileRole,
  Review,
  ScoreAxis,
  StyleAxis,
} from "./db";

/* ── 공통 봉투 ─────────────────────────────────────── */

export interface ApiError {
  code: string;
  message: string;
}

export type ApiResponse<T> = { data: T } | { error: ApiError };

/* ── auth (김민경) ─────────────────────────────────── */

export interface StudentOnboardingRequest {
  grade_level: GradeLevel;
  join_code: string;
}
export interface StudentOnboardingResponse {
  class: Class;
}

export interface TeacherOnboardingRequest {
  school_name: string;
  grade_level: number;
  class_no: number;
}
export interface TeacherOnboardingResponse {
  class: Class;
  join_code: string;
}

/**
 * GET /api/profile — 로그인한 사람의 정보. '나' 화면 머리글용 (#71).
 * class_label 은 학생이면 들어간 반, 교사면 자기 반. 아직 온보딩 전이면 null.
 */
export interface MeResponse {
  display_name: string;
  role: ProfileRole;
  /** 교사는 null */
  grade_level: GradeLevel | null;
  /** 온보딩에서 고른 탐험가 등급. 안 골랐으면 null (spec §2b) */
  explorer_rank: ExplorerRank | null;
  /** 예: "5학년 2반" */
  class_label: string | null;
}

/** 둘 중 하나 이상. explorer_rank 는 null 로 지울 수 있다 */
export interface UpdateProfileRequest {
  grade_level?: GradeLevel;
  explorer_rank?: ExplorerRank | null;
}
export interface UpdateProfileResponse {
  profile: Profile;
}

/** DELETE /api/profile — 계정과 모든 데이터를 지운다. 세션도 끝난다 */
export interface DeleteProfileResponse {
  deleted: true;
}

/* ── books (이승환) ────────────────────────────────── */

export interface BookSearchResponse {
  books: Book[];
}

export interface BookRecommendResponse {
  books: Book[];
  /** 왜 이 책을 골랐는지 화면에 보여줄 태그 */
  reason_tags: string[];
}

export interface BookDetailResponse {
  book: Book;
}

/* ── review (박재경) ───────────────────────────────── */

export interface CreateReviewRequest {
  book_id: string;
}
export interface CreateReviewResponse {
  review: Review;
}

/** 자동 저장. 2초 디바운스 */
export interface UpdateReviewRequest {
  body: string;
}
export interface UpdateReviewResponse {
  review: Review;
}

/** 화면에 보여주는 빈틈. DB 의 review_gaps 행에서 필요한 것만 추린 모양 */
export interface ReviewGapView {
  id: string;
  ord: number;
  quote: string;
  type: GapType;
  reason: string;
}

/** AI #2 실행 + AI #3 미리 생성 */
export interface SubmitReviewResponse {
  gaps: ReviewGapView[];
}

/* ── verification (박재경 · ai 모듈 사용) ──────────── */

/**
 * 질문 발급. 재시도도 같은 모양을 돌려준다.
 * seconds 는 ANSWER_WINDOW_SEC 환경변수에서 온다 (기본 45, 허용 30-60).
 */
export interface QuestionResponse {
  verification_id: string;
  question: string;
  /** 학생이 쓴 문장 원문. 화면에서 강조해 보여준다 */
  quote: string;
  seconds: number;
}

export interface AnswerRequest {
  answer: string;
}

export interface AnswerScores {
  logic_consistency: ScoreAxis;
  specificity: ScoreAxis;
  style_consistency: StyleAxis;
}

export interface AnswerResponse {
  passed: boolean;
  scores: AnswerScores;
  feedback: string;
  /** 통과 50, 실패 0 */
  points: number;
}

/* ── reader (강민구) ───────────────────────────────── */

export interface ReaderChapterResponse {
  title: string;
  body: string;
}

/** 사전 뜻 하나. 문맥을 보지 않으므로 여러 개를 주고 아이가 고른다 (#43) */
export interface DictSense {
  definition: string;
}

export interface DictResponse {
  word: string;
  /** = senses[0]. 뜻 하나만 아는 쪽이 깨지지 않게 남긴다 */
  definition: string;
  /** 국립국어원 한국어기초사전 */
  source: string;
  /** 쉬운 등급의 표제어부터, 사전에 적힌 순서대로. 1~5개 (#43) */
  senses: DictSense[];
}

/* ── 게임화 (spec §5b, 2026-09-18) ─────────────────── */

/** GET /api/characters — 도감 한 칸 */
export interface CharacterView {
  book_id: string;
  book_title: string;
  cover_url: string | null;
  name: string;
  stage: CharacterStage;
  /** stage_names[stage] */
  stage_name: string;
  art_seed: string;
  obtained_at: string;
}
export interface CharactersResponse {
  characters: CharacterView[];
}

/** POST /api/reading/progress */
export interface ReadingProgressRequest {
  book_id: string;
  chapter_no: number;
}
export interface ReadingProgressResponse {
  read_chapters: number;
  total_chapters: number;
  /** 캐릭터 없는 책이면 null */
  character_stage: CharacterStage | null;
}

/** POST /api/checkpoints */
export interface CreateCheckpointRequest {
  book_id: string;
  chapter_no: number;
}
export interface CreateCheckpointResponse {
  checkpoint_id: string;
  question: string;
}

/** POST /api/checkpoints/:id/answer */
export interface AnswerCheckpointRequest {
  answer: string;
}
export interface AnswerCheckpointResponse {
  passed: boolean;
  feedback: string;
  character_stage: CharacterStage | null;
}

/* ── rewards / growth / ranking / guardian (문민재) ── */

export interface PointsLedgerView {
  id: string;
  delta: number;
  reason: PointReason;
  created_at: string;
}

export interface PointsResponse {
  /** sum(delta). 저장된 잔액 컬럼이 아니다 */
  balance: number;
  ledger: PointsLedgerView[];
}

/** 국회도서관 ebook 열람권 −300, 오디오북 −450 (docs/spec.md §4) */
export type ExchangeKind = "ebook" | "audiobook";

export interface ExchangeRequest {
  kind: ExchangeKind;
}
export interface ExchangeResponse {
  balance: number;
  voucher_url: string;
}

export interface GrowthStampView {
  genre: string;
  completed_count: number;
  /** 완독 3권당 1개 */
  stamps: number;
}

export interface GrowthResponse {
  streak: {
    current_days: number;
    longest_days: number;
  };
  tree_stage: number;
  leaves: number;
  stamps: GrowthStampView[];
}

export interface ClassRankingRow {
  class_id: string;
  label: string;
  /** AI 검증을 통과한 완독만 집계 */
  verified_count: number;
  rank: number;
}

export interface ClassRankingResponse {
  my_class: ClassRankingRow;
  rows: ClassRankingRow[];
}

export interface ChallengeView {
  id: string;
  title: string;
  target: number;
  value: number;
  starts_on: string;
  ends_on: string;
}

export interface ChallengesResponse {
  class_goal: ChallengeView | null;
  season: ChallengeView | null;
}

export interface GuardianLinkResponse {
  url: string;
}

/**
 * 인증 없음. service role 을 쓰는 Route Handler 경유로만 조회한다.
 * 독후감 본문은 여기에 없다 — 의도적이다 (CLAUDE.md §5).
 */
export interface GuardianSummaryResponse {
  summary: {
    display_name: string;
    completed_count: number;
    points: number;
    avg_score: number;
  };
  books: Array<{
    title: string;
    author: string;
    cover_url: string | null;
    passed: boolean;
  }>;
}

/* ── teacher (김민경) ──────────────────────────────── */

export interface TeacherClassResponse {
  class: Class;
  join_code: string;
  stats: {
    student_count: number;
    completed_count: number;
    avg_score: number;
  };
}

/** 독후감 본문은 절대 포함되지 않는다 (docs/spec.md §5) */
export interface TeacherStudentRow {
  student_id: string;
  name: string;
  passed_count: number;
  avg_score: number;
  streak: number;
  last_active: string | null;
}

export interface TeacherStudentsResponse {
  rows: TeacherStudentRow[];
}

export interface TeacherRankingResponse {
  rows: ClassRankingRow[];
}
