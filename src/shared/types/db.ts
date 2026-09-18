/**
 * DB 행 타입 — docs/spec.md §1, §2 의 스키마와 1:1로 맞춘다.
 * spec.md 가 권위 있는 원본이다. 스키마가 바뀌면 마이그레이션과 이 파일을 같이 고친다.
 *
 * 소유: 김민경. 다른 오너 세션에서 임의로 수정하지 말 것 (CLAUDE.md §2).
 */

/* ── 1. Enums ──────────────────────────────────────── */

export type ProfileRole = "student" | "teacher";

export type ReviewStatus =
  | "draft"
  | "analyzing"
  | "questioning"
  | "passed"
  | "failed";

/**
 * 빈틈 유형 3종 + core_claim (0013). core_claim 은 빈틈이 아니라 "빈틈이 없을 때
 * 그래도 물어볼 핵심 주장 한 문장" — 화면은 다르게 안내하고 채점 기준은 같다 (issue #14).
 */
export type GapType =
  | "unsupported_claim"
  | "vague_statement"
  | "feeling_only"
  | "core_claim";

/** 1=초1 … 6=초6, 7=중1, 8=중2, 9=중3 */
export type GradeLevel = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;

export type PointReason =
  | "verification_pass"
  | "ebook_pass"
  | "audiobook_pass"
  | "admin_adjust";

export type ChallengeKind = "class_goal" | "season";

/** 채점 3축 중 논리 일관성 · 구체성 */
export type ScoreAxis = "pass" | "weak" | "fail";
/** 문체 일관성 축만 값이 다르다 */
export type StyleAxis = "same" | "shifted";

/* ── 2. Tables ─────────────────────────────────────── */

export interface Profile {
  id: string; // = auth.users.id
  role: ProfileRole;
  display_name: string;
  /** 학생만. 교사는 null */
  grade_level: GradeLevel | null;
  /** 온보딩에서 학생이 고른 탐험가 등급. 화면 톤에만 쓴다 — 학년을 대체하지 않는다 (spec §2b) */
  explorer_rank: ExplorerRank | null;
  created_at: string;
}

/* ── 게임화 (spec §2b, 0014) ─────────────────────────── */

export type ExplorerRank = "새싹" | "탐험가" | "대장";

/** 0 알 → 1 부화 → 2 최종(검증 통과). 내려가지 않는다 */
export type CharacterStage = 0 | 1 | 2;

/** 캐릭터 카탈로그. 책 한 권에 한 마리, curated 책에만 (시드) */
export interface Character {
  id: string;
  book_id: string;
  name: string;
  /** 정확히 3개 — 알 · 1단계 · 2단계 이름 */
  stage_names: string[];
  /** 그림 대신 표지 그라데이션 위에 그릴 재료. 화면이 해석한다 */
  art_seed: string;
  created_at: string;
}

/** 학생이 가진 캐릭터. stage 는 트리거만 올린다 */
export interface StudentCharacter {
  student_id: string;
  book_id: string;
  stage: CharacterStage;
  obtained_at: string;
  evolved_at: string | null;
}

/** 서재 읽기 기록 = 표지 퍼즐 조각. 장 끝에서 학생 본인이 넣는다 */
export interface ReadingProgress {
  student_id: string;
  book_id: string;
  chapter_no: number;
  read_at: string;
}

/** 장 끝 한 문항 (AI #6). 책갈피는 없다 — 부화만 */
export interface Checkpoint {
  id: string;
  student_id: string;
  book_id: string;
  chapter_no: number;
  question: string;
  answer: string | null;
  passed: boolean | null;
  feedback: string | null;
  asked_at: string;
  answered_at: string | null;
}

export interface Class {
  id: string;
  teacher_id: string;
  school_name: string;
  grade_level: number;
  /** 예: 2반 */
  class_no: number;
  /** 6자 대문자 영숫자. 헷갈리는 0/O/1/I 는 제외 */
  join_code: string;
  created_at: string;
}

/** 학생은 활성 학급을 최대 하나만 가진다 */
export interface ClassMember {
  class_id: string;
  student_id: string;
  joined_at: string;
}

export interface Book {
  id: string;
  /** 저작권 만료 텍스트는 null */
  isbn13: string | null;
  title: string;
  author: string;
  publisher: string;
  /** 알라딘 image URL */
  cover_url: string | null;
  /** 앱의 10~15개 장르 태그로 정규화된 값 */
  tags: string[];
  target_grade_min: number | null;
  target_grade_max: number | null;
  /** true → 책잇 서재에서 읽을 수 있음 */
  is_public_domain: boolean;
  /** 국회전자도서관 딥링크 */
  library_url: string | null;
  aladin_url: string | null;
  /** 추천 목록 후보 (0012). 시드가 고른 책만 true, 검색으로 저장된 책은 false */
  curated: boolean;
}

/** 저작권 만료 도서 전용 */
export interface BookContent {
  book_id: string;
  chapter_no: number;
  title: string;
  body: string;
}

/**
 * (student, book) 당 활성 독후감 하나.
 * 다시 읽으면 새 행을 만든다.
 */
export interface Review {
  id: string;
  student_id: string;
  book_id: string;
  /** 학생 본인에게만 보인다. is_shared 가 true 일 때만 예외 (CLAUDE.md §5) */
  body: string;
  char_count: number;
  status: ReviewStatus;
  /** 학생이 직접 켠 공개 여부. 기본 false */
  is_shared: boolean;
  created_at: string;
  updated_at: string;
}

/**
 * AI 호출 #2 의 결과.
 * 학생이 고쳐서 다시 제출하면 삭제 후 재생성한다.
 */
export interface ReviewGap {
  id: string;
  review_id: string;
  /** 1-3 */
  ord: number;
  quote: string;
  gap_type: GapType;
  reason: string;
}

/**
 * 실패한 시도는 절대 지우지 않는다.
 * 재시도는 attempt_no + 1 로 새 행을 넣고, 가능하면 다른 gap 에서 새 질문을 만든다.
 */
export interface Verification {
  id: string;
  review_id: string;
  /** RLS 속도를 위해 비정규화 */
  student_id: string;
  attempt_no: number;
  gap_id: string;
  question: string;
  answer: string | null;
  logic_consistency: ScoreAxis | null;
  specificity: ScoreAxis | null;
  style_consistency: StyleAxis | null;
  passed: boolean;
  feedback: string | null;
  /** 통과 50, 실패 0 */
  points_awarded: number;
  /** 타이머의 진실의 원천은 클라이언트가 아니라 이 두 값이다 */
  asked_at: string;
  answered_at: string | null;
}

/**
 * Append-only. 잔액 컬럼은 없다 — 잔액 = sum(delta) (CLAUDE.md §4).
 */
export interface PointsLedgerEntry {
  id: string;
  student_id: string;
  /** 부호 있는 값. 적립 +, 차감 − */
  delta: number;
  reason: PointReason;
  /** verification.id 또는 교환 행 id */
  ref_id: string | null;
  created_at: string;
}

export interface Streak {
  student_id: string;
  current_days: number;
  longest_days: number;
  last_passed_on: string | null;
}

/** 완독 3권 = 도장 1개 */
export interface GenreStamp {
  student_id: string;
  genre: string;
  completed_count: number;
}

export interface Challenge {
  id: string;
  kind: ChallengeKind;
  class_id: string | null;
  title: string;
  target: number;
  starts_on: string;
  ends_on: string;
}

export interface ChallengeProgress {
  challenge_id: string;
  student_id: string;
  value: number;
}

export interface GuardianLink {
  /** 32자 이상 랜덤 */
  token: string;
  student_id: string;
  created_at: string;
  revoked_at: string | null;
}
