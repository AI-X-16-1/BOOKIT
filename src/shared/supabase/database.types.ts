/**
 * supabase-js 제네릭에 넘기는 Database 타입.
 *
 * 소유: 김민경 (CLAUDE.md §2).
 *
 * supabase CLI 로 생성하지 않고 손으로 쓴다 — 생성기는 실행 중인 DB 가 필요하고,
 * 우리 스키마의 권위 있는 원본은 supabase/migrations 와 docs/spec.md 다.
 * 행 타입은 src/shared/types/db.ts 를 그대로 재사용한다. 두 번 쓰지 않는다.
 *
 * 스키마를 바꿀 때 같이 고쳐야 하는 곳: 마이그레이션 → db.ts → 이 파일.
 */

import type {
  Book,
  BookContent,
  Challenge,
  ChallengeKind,
  ChallengeProgress,
  Class,
  ClassMember,
  GapType,
  GenreStamp,
  GuardianLink,
  PointReason,
  PointsLedgerEntry,
  Profile,
  ProfileRole,
  Review,
  ReviewGap,
  ReviewStatus,
  ScoreAxis,
  Streak,
  StyleAxis,
  Verification,
} from "@/shared/types/db";

/**
 * interface 는 암묵적 index signature 를 얻지 못해서 supabase-js 의 GenericSchema 제약에
 * 걸리지 않는다. 제약에 걸리면 타입 추론이 조용히 never 로 떨어진다 — 에러도 안 난다.
 * 그래서 db.ts 의 interface 를 mapped type 으로 한 번 펼쳐서 넘긴다.
 * (supabase CLI 생성물이 interface 대신 type 별칭을 쓰는 이유가 이것이다.)
 */
type Flatten<T> = { [K in keyof T]: T[K] };

/**
 * insert 에서 생략할 수 있는 컬럼 = DB 기본값이 있거나 nullable 인 컬럼.
 * Optional 에 적는 이름은 마이그레이션의 default 절과 맞춰야 한다.
 */
type Insertable<Row, Optional extends keyof Row> = Flatten<
  Omit<Row, Optional> & Partial<Pick<Row, Optional>>
>;

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: Flatten<Profile>;
        Insert: Insertable<Profile, "role" | "grade_level" | "created_at">;
        Update: Flatten<Partial<Profile>>;
        // id → auth.users. auth 스키마는 PostgREST 에 노출하지 않으므로 비워 둔다.
        Relationships: [];
      };
      classes: {
        Row: Flatten<Class>;
        Insert: Insertable<Class, "id" | "created_at">;
        Update: Flatten<Partial<Class>>;
        Relationships: [
          {
            foreignKeyName: "classes_teacher_id_fkey";
            columns: ["teacher_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      class_members: {
        Row: Flatten<ClassMember>;
        Insert: Insertable<ClassMember, "joined_at">;
        Update: Flatten<Partial<ClassMember>>;
        Relationships: [
          {
            foreignKeyName: "class_members_class_id_fkey";
            columns: ["class_id"];
            isOneToOne: false;
            referencedRelation: "classes";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "class_members_student_id_fkey";
            columns: ["student_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      books: {
        Row: Flatten<Book>;
        Insert: Insertable<
          Book,
          | "id"
          | "isbn13"
          | "cover_url"
          | "tags"
          | "target_grade_min"
          | "target_grade_max"
          | "is_public_domain"
          | "library_url"
          | "aladin_url"
        >;
        Update: Flatten<Partial<Book>>;
        Relationships: [];
      };
      book_contents: {
        Row: Flatten<BookContent>;
        Insert: Flatten<BookContent>;
        Update: Flatten<Partial<BookContent>>;
        Relationships: [
          {
            foreignKeyName: "book_contents_book_id_fkey";
            columns: ["book_id"];
            isOneToOne: false;
            referencedRelation: "books";
            referencedColumns: ["id"];
          },
        ];
      };
      reviews: {
        Row: Flatten<Review>;
        Insert: Insertable<
          Review,
          | "id"
          | "body"
          | "char_count"
          | "status"
          | "is_shared"
          | "created_at"
          | "updated_at"
        >;
        Update: Flatten<Partial<Review>>;
        Relationships: [
          {
            foreignKeyName: "reviews_student_id_fkey";
            columns: ["student_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "reviews_book_id_fkey";
            columns: ["book_id"];
            isOneToOne: false;
            referencedRelation: "books";
            referencedColumns: ["id"];
          },
        ];
      };
      review_gaps: {
        Row: Flatten<ReviewGap>;
        Insert: Insertable<ReviewGap, "id">;
        Update: Flatten<Partial<ReviewGap>>;
        Relationships: [
          {
            foreignKeyName: "review_gaps_review_id_fkey";
            columns: ["review_id"];
            isOneToOne: false;
            referencedRelation: "reviews";
            referencedColumns: ["id"];
          },
        ];
      };
      verifications: {
        Row: Flatten<Verification>;
        Insert: Insertable<
          Verification,
          | "id"
          | "answer"
          | "logic_consistency"
          | "specificity"
          | "style_consistency"
          | "passed"
          | "feedback"
          | "points_awarded"
          | "asked_at"
          | "answered_at"
        >;
        Update: Flatten<Partial<Verification>>;
        Relationships: [
          {
            foreignKeyName: "verifications_review_id_fkey";
            columns: ["review_id"];
            isOneToOne: false;
            referencedRelation: "reviews";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "verifications_student_id_fkey";
            columns: ["student_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "verifications_gap_id_fkey";
            columns: ["gap_id"];
            isOneToOne: false;
            referencedRelation: "review_gaps";
            referencedColumns: ["id"];
          },
        ];
      };
      points_ledger: {
        Row: Flatten<PointsLedgerEntry>;
        // append-only. 잔액 컬럼도, update 경로도 없다 (CLAUDE.md §4).
        Insert: Insertable<PointsLedgerEntry, "id" | "ref_id" | "created_at">;
        Update: never;
        Relationships: [
          {
            foreignKeyName: "points_ledger_student_id_fkey";
            columns: ["student_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      streaks: {
        Row: Flatten<Streak>;
        Insert: Insertable<
          Streak,
          "current_days" | "longest_days" | "last_passed_on"
        >;
        Update: Flatten<Partial<Streak>>;
        Relationships: [
          {
            foreignKeyName: "streaks_student_id_fkey";
            columns: ["student_id"];
            isOneToOne: true;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      genre_stamps: {
        Row: Flatten<GenreStamp>;
        Insert: Insertable<GenreStamp, "completed_count">;
        Update: Flatten<Partial<GenreStamp>>;
        Relationships: [
          {
            foreignKeyName: "genre_stamps_student_id_fkey";
            columns: ["student_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      challenges: {
        Row: Flatten<Challenge>;
        Insert: Insertable<Challenge, "id" | "class_id">;
        Update: Flatten<Partial<Challenge>>;
        Relationships: [
          {
            foreignKeyName: "challenges_class_id_fkey";
            columns: ["class_id"];
            isOneToOne: false;
            referencedRelation: "classes";
            referencedColumns: ["id"];
          },
        ];
      };
      challenge_progress: {
        Row: Flatten<ChallengeProgress>;
        Insert: Insertable<ChallengeProgress, "value">;
        Update: Flatten<Partial<ChallengeProgress>>;
        Relationships: [
          {
            foreignKeyName: "challenge_progress_challenge_id_fkey";
            columns: ["challenge_id"];
            isOneToOne: false;
            referencedRelation: "challenges";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "challenge_progress_student_id_fkey";
            columns: ["student_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      guardian_links: {
        Row: Flatten<GuardianLink>;
        Insert: Insertable<GuardianLink, "created_at" | "revoked_at">;
        Update: Flatten<Partial<GuardianLink>>;
        Relationships: [
          {
            foreignKeyName: "guardian_links_student_id_fkey";
            columns: ["student_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
    };

    /**
     * 뷰는 읽기 전용이다.
     * null 여부는 뷰 정의문(0003)을 보고 직접 적었다 — count 와 coalesce 로 감싼 값은 not null 이다.
     * 두 뷰 모두 독후감 본문·답변 원문 컬럼이 없다. 추가하지 않는다 (CLAUDE.md §5).
     */
    Views: {
      v_teacher_student_progress: {
        Row: {
          student_id: string;
          name: string;
          passed_count: number;
          avg_score: number;
          /** 통과 이력이 없는 학생은 null */
          last_active: string | null;
        };
        Relationships: [];
      };
      v_class_ranking: {
        Row: {
          class_id: string;
          /** "한빛초 5학년 2반" 형태로 DB 에서 만들어 준다 */
          label: string;
          verified_count: number;
        };
        Relationships: [];
      };
    };

    Functions: {
      /** 교사 온보딩에서 6자리 코드를 받을 때 rpc 로 호출한다 */
      generate_join_code: {
        Args: Record<PropertyKey, never>;
        Returns: string;
      };
      my_class_id: {
        Args: Record<PropertyKey, never>;
        Returns: string | null;
      };
      is_teacher_of: {
        Args: { target_student: string };
        Returns: boolean;
      };
      /** 3축을 0-100 하나로 환산 */
      comprehension_score: {
        Args: { logic: ScoreAxis; spec: ScoreAxis; style: StyleAxis };
        Returns: number;
      };
    };

    Enums: {
      profile_role: ProfileRole;
      review_status: ReviewStatus;
      gap_type: GapType;
      point_reason: PointReason;
      challenge_kind: ChallengeKind;
      score_axis: ScoreAxis;
      style_axis: StyleAxis;
    };

    CompositeTypes: Record<never, never>;
  };
}

/**
 * 회귀 감시.
 *
 * supabase-js 의 GenericSchema 제약을 구조만 베껴 둔 것이다 (타입이 export 되지 않는다).
 * 제약을 못 맞추면 supabase-js 는 에러를 내지 않고 Schema 를 never 로 떨어뜨린다 —
 * 그 순간 모든 쿼리 타입이 사라지고 없는 컬럼명도 조용히 통과한다.
 * 스키마를 고치다 그 상태가 되면 여기서 컴파일 에러로 먼저 걸린다.
 */
type GenericSchemaShape = {
  Tables: Record<
    string,
    {
      Row: Record<string, unknown>;
      Insert: Record<string, unknown>;
      Update: Record<string, unknown>;
      Relationships: unknown[];
    }
  >;
  Views: Record<
    string,
    { Row: Record<string, unknown>; Relationships: unknown[] }
  >;
  Functions: Record<string, { Args: Record<string, unknown>; Returns: unknown }>;
};

type Assert<T extends GenericSchemaShape> = T;
export type PublicSchema = Assert<Database["public"]>;
