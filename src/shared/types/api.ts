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
  Class,
  GapType,
  GradeLevel,
  PointReason,
  Profile,
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

export interface UpdateProfileRequest {
  grade_level: GradeLevel;
}
export interface UpdateProfileResponse {
  profile: Profile;
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

export interface DictResponse {
  word: string;
  definition: string;
  /** 국립국어원 한국어기초사전 */
  source: string;
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
