/**
 * level/server/test — 읽기 수준 진단. owner: 박재경
 *
 * 2026-09-18 추가 요청 (spec 에 없던 기능 — PR 본문에 계약 초안을 적어 뒀다).
 * 온보딩에서 학생이 고른 학년이 맞는지, 짧은 지문 하나로 가늠해 **추천 학년**을 준다.
 *
 * 지키는 것:
 *   - **표를 만들지 않는다.** 진단 이력을 쌓지 않으므로 마이그레이션이 없다.
 *     학생이 결과를 받아들이면 PATCH /api/profile 로 grade_level 한 칸이 바뀐다
 *   - **책갈피를 주지 않는다.** points_ledger·streaks·characters 를 건드리지 않는다 (§4 불변)
 *   - **검증 파이프라인과 겹치지 않는다.** AI #7 은 따로이고 #1~#4 는 그대로다
 *   - **지문을 새로 쓰지 않는다.** 서재(공개 도메인) 본문에서 뽑는다
 *
 * 상태를 서버에 두지 않아서, 채점 요청이 문항을 되보낸다. 문항을 바꿔 보내도
 * 얻을 게 없다 — 이 진단은 상도 벌도 없고 결과는 자기 학년 추천뿐이다.
 * 다만 **지문 본문은 되받지 않고** book_id 로 서버가 다시 읽는다. 아이가 안 읽은
 * 글로 판정이 나가면 추천 자체가 뜻을 잃기 때문이다.
 */
import "server-only";

import { buildLevelTest, judgeLevelTest, type PassageContext } from "@/modules/ai";
import type { BookitClient } from "@/shared/supabase";

/** 진단 지문으로 쓸 분량. 프롬프트의 PASSAGE_MAX_CHARS 와 같은 뜻이다 */
const PASSAGE_CHARS = 1_200;

export interface LevelTestStart {
  bookId: string;
  bookTitle: string;
  author: string;
  passage: string;
  questions: string[];
}

export interface LevelTestResult {
  recommendedGrade: number;
  confidence: "low" | "medium" | "high";
  feedback: string;
  /** 지금 프로필에 있는 학년. 화면이 "그대로 둘래" 를 그리는 데 쓴다 */
  currentGrade: number | null;
}

export type LevelResult<T> =
  | { ok: true; data: T }
  | { ok: false; code: string; message: string; status: number };

const failure = (code: string, message: string, status: number): LevelResult<never> => ({
  ok: false,
  code,
  message,
  status,
});

/** 문자열 → 안정적인 양수. 같은 학생에게 늘 같은 지문이 나오게 한다 */
function seed(value: string): number {
  let n = 0;
  for (const ch of value) n = (n * 31 + ch.charCodeAt(0)) % 100000;
  return n;
}

/**
 * 그 학년에 맞는 서재 책 하나의 첫 장 앞부분.
 *
 * 2026-09-18 실측: books 162권 중 서재(공개 도메인 + curated + 1장 본문)는 56권이고
 * **그 56권은 전부 학년대가 채워져 있다** (학년대가 빈 32권은 전부 검색 유입분이라
 * 애초에 후보가 아니다). 학년별 후보 수도 제일 적은 1학년이 8권이다
 * — 1:8 · 2:22 · 3:32 · 4:31 · 5:20 · 6:11 · 7:11 · 8:14 · 9:14.
 *
 * 그래서 아래 폴백(학년으로 못 좁히면 전체에서 고른다)은 지금 데이터에서는 **닿지 않는다.**
 * 그래도 남겨 둔다 — 서재는 계속 늘고(#137 이 47 → 56), 학년대를 안 적은 책이 한 권만
 * 들어와도 그 학생은 지문을 못 받는다. 빈 화면 대신 덜 맞는 지문이 낫다.
 * 닿지 않는 분기라는 것을 알고 두는 것이라, "빈 책이 많아서" 가 이유가 아니다.
 */
async function pickPassage(
  supabase: BookitClient,
  userId: string,
  gradeLevel: number | null,
): Promise<LevelResult<{ bookId: string; title: string; author: string; body: string }>> {
  const base = supabase
    .from("books")
    .select("id, title, author, target_grade_min, target_grade_max")
    .eq("is_public_domain", true)
    .eq("curated", true);

  const { data: all, error } = await base;
  if (error) throw error;

  const books = all ?? [];
  if (books.length === 0) {
    return failure("no_passage", "읽을 지문을 찾지 못했어. 잠깐 뒤에 다시 해볼까?", 503);
  }

  const fit =
    gradeLevel === null
      ? []
      : books.filter(
          (b) =>
            (b.target_grade_min ?? 1) <= gradeLevel && gradeLevel <= (b.target_grade_max ?? 9),
        );
  const pool = fit.length > 0 ? fit : books;

  // 같은 학생에게는 늘 같은 지문 — 시연에서 화면이 매번 달라지지 않게
  const chosen = pool[seed(userId) % pool.length];

  const { data: chapter, error: chapterError } = await supabase
    .from("book_contents")
    .select("body")
    .eq("book_id", chosen.id)
    .eq("chapter_no", 1)
    .maybeSingle();

  if (chapterError) throw chapterError;
  if (!chapter) {
    return failure("no_passage", "읽을 지문을 찾지 못했어. 잠깐 뒤에 다시 해볼까?", 503);
  }

  return {
    ok: true,
    data: {
      bookId: chosen.id,
      title: chosen.title,
      author: chosen.author,
      body: chapter.body.slice(0, PASSAGE_CHARS),
    },
  };
}

/** 프로필의 학년. 교사이거나 아직 없으면 null */
async function readGrade(
  supabase: BookitClient,
  userId: string,
): Promise<number | null> {
  const { data, error } = await supabase
    .from("profiles")
    .select("grade_level")
    .eq("id", userId)
    .maybeSingle();

  if (error) throw error;
  return data?.grade_level ?? null;
}

/** 지문 + 문항 셋. 화면이 이걸 받아 그대로 보여준다 */
export async function startLevelTest(
  supabase: BookitClient,
  userId: string,
): Promise<LevelResult<LevelTestStart>> {
  const gradeLevel = await readGrade(supabase, userId);
  const picked = await pickPassage(supabase, userId, gradeLevel);
  if (!picked.ok) return picked;

  const { bookId, title, author, body } = picked.data;
  const passage: PassageContext = { bookTitle: title, author, body };
  const { questions } = await buildLevelTest(passage, gradeLevel ?? undefined);

  return {
    ok: true,
    data: { bookId, bookTitle: title, author, passage: body, questions },
  };
}

/**
 * 답 셋 → 추천 학년.
 *
 * 지문은 book_id 로 서버가 다시 읽는다 (본문을 되받지 않는다). 문항은 되받은
 * 것을 쓴다 — 서버에 저장하지 않았기 때문이고, 바꿔 보내도 얻을 것이 없다.
 */
export async function finishLevelTest(
  supabase: BookitClient,
  userId: string,
  bookId: string,
  questions: string[],
  answers: string[],
): Promise<LevelResult<LevelTestResult>> {
  const gradeLevel = await readGrade(supabase, userId);

  const { data: book, error } = await supabase
    .from("books")
    .select("title, author")
    .eq("id", bookId)
    .eq("is_public_domain", true)
    .maybeSingle();

  if (error) throw error;
  if (!book) return failure("no_passage", "지문을 다시 찾지 못했어.", 404);

  const { data: chapter, error: chapterError } = await supabase
    .from("book_contents")
    .select("body")
    .eq("book_id", bookId)
    .eq("chapter_no", 1)
    .maybeSingle();

  if (chapterError) throw chapterError;
  if (!chapter) return failure("no_passage", "지문을 다시 찾지 못했어.", 404);

  const passage: PassageContext = {
    bookTitle: book.title,
    author: book.author,
    body: chapter.body.slice(0, PASSAGE_CHARS),
  };

  const result = await judgeLevelTest(
    passage,
    questions,
    answers,
    gradeLevel ?? undefined,
  );

  return {
    ok: true,
    data: {
      recommendedGrade: result.recommendedGrade,
      confidence: result.confidence,
      feedback: result.feedback,
      currentGrade: gradeLevel,
    },
  };
}
