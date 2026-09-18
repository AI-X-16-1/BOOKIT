/**
 * verification/server/characters — 도감. owner: 박재경
 *
 * 9/18 마감 스프린트(docs/sprint-0918.md) ② "도감 — 표지 + 캐릭터 합성".
 * 목업 7 #5 · 목업 8 #4.
 *
 * 왜 verification 모듈인가: 도감에 들어오는 조건이 **검증 통과** 하나이고
 * (spec §2b 의 stage 2), ★ 등급도 보스전을 몇 번째에 잡았는지 —
 * `verifications.attempt_no` — 로 정해진다. 도감은 보스전의 전리품이라
 * 검증 데이터를 읽는 이 모듈에 둔다. 스프린트도 이 화면을 박재경에게 줬다.
 * 캐릭터 **진화**(stage 를 올리는 쪽)는 강민구이고 이미 0014 트리거에 있다 —
 * 여기서는 아무것도 쓰지 않는다.
 *
 * 읽기 전용이다. `student_characters` 에는 학생용 insert/update 정책이 아예
 * 없어서 (0014) 쓰려고 해도 막힌다. stage 는 트리거만 올린다.
 */
import "server-only";

import type { BookitClient } from "@/shared/supabase";
import type { CharacterStage, CharacterView } from "@/shared/types";

/** 도감 한 칸. 아직 못 잡은 캐릭터도 칸은 있다 (목업의 "미포획") */
export interface CollectionEntry {
  bookId: string;
  bookTitle: string;
  coverUrl: string | null;
  tags: string[];
  /** 캐릭터 이름 (2단계 기준). 못 잡았어도 이름은 가린다 — 아래 stageName 을 쓴다 */
  name: string;
  artSeed: string;
  /** 아직 한 장도 안 읽은 책이면 null — 알조차 없다 */
  stage: CharacterStage | null;
  /** stage_names[stage]. stage 가 null 이면 null */
  stageName: string | null;
  obtainedAt: string | null;
  /**
   * 1~3. 포획(stage 2)한 캐릭터만. 보스전을 몇 번째 시도에 잡았는지다 —
   * 한 번에 잡으면 ★★★ (목업 7 #5 의 각주).
   */
  stars: number | null;
}

export interface Collection {
  entries: CollectionEntry[];
  /** 포획한 수 = stage 2 */
  captured: number;
  /** 카탈로그 전체 (curated 책 수). 목업의 "12 / 40" 중 40 */
  total: number;
  /** 장르 칩에 쓸 태그. 많이 걸린 순서 */
  tags: string[];
}

/** 시도 횟수 → 별. 한 번에 3개, 그 뒤로 하나씩 줄고 1개에서 멈춘다 */
function starsFor(attemptNo: number): number {
  return Math.max(1, 4 - attemptNo);
}

/**
 * 책별 ★ 등급. 통과한 검증의 **가장 빠른** 시도를 쓴다.
 *
 * 한 책을 다시 읽으면 독후감 행이 새로 생기므로(spec §2 "Re-reading creates a new row")
 * 한 책에 통과가 여러 번 있을 수 있다. 그때는 제일 잘한 기록을 남긴다 — 도감은
 * 성적표가 아니라 수집품이고, 뒤에 한 번 못 잡았다고 별이 깎이면 다시 읽기를 말리게 된다.
 */
async function loadStars(
  supabase: BookitClient,
  userId: string,
): Promise<Record<string, number>> {
  const { data, error } = await supabase
    .from("verifications")
    .select("attempt_no, reviews (book_id)")
    .eq("student_id", userId)
    .eq("passed", true);

  if (error) throw error;

  const best: Record<string, number> = {};
  for (const row of data ?? []) {
    const bookId = row.reviews?.book_id;
    if (!bookId) continue;
    best[bookId] = Math.min(best[bookId] ?? Number.MAX_SAFE_INTEGER, row.attempt_no);
  }

  return Object.fromEntries(
    Object.entries(best).map(([bookId, attempt]) => [bookId, starsFor(attempt)]),
  );
}

/** 포획 → 부화 → 알 → 미포획 순. 같은 단계 안에서는 제목순 */
function compare(a: CollectionEntry, b: CollectionEntry): number {
  const rank = (e: CollectionEntry) => (e.stage === null ? -1 : e.stage);
  return rank(b) - rank(a) || a.bookTitle.localeCompare(b.bookTitle, "ko");
}

/**
 * 도감 전체. 카탈로그(characters)는 누구나 읽고(0014 `characters_select_all`),
 * 내가 가진 것(student_characters)은 내 행만 내려온다.
 *
 * 빈 칸도 함께 내려보낸다 — 아직 못 잡은 캐릭터가 보여야 "다음에 뭘 잡을까" 가
 * 생긴다. 카탈로그는 curated 책 수(9/18 기준 71권)라 한 번에 받아도 된다.
 */
export async function loadCollection(
  supabase: BookitClient,
  userId: string,
): Promise<Collection> {
  const [catalogResult, ownedResult, stars] = await Promise.all([
    supabase
      .from("characters")
      .select("book_id, name, stage_names, art_seed, books (title, cover_url, tags)"),
    supabase
      .from("student_characters")
      .select("book_id, stage, obtained_at")
      .eq("student_id", userId),
    loadStars(supabase, userId),
  ]);

  if (catalogResult.error) throw catalogResult.error;
  if (ownedResult.error) throw ownedResult.error;

  const mine = new Map(ownedResult.data?.map((row) => [row.book_id, row]) ?? []);

  const entries: CollectionEntry[] = [];
  const tagCount: Record<string, number> = {};

  for (const row of catalogResult.data ?? []) {
    // 책이 지워졌는데 캐릭터만 남는 일은 on delete cascade 로 막혀 있지만,
    // 조인이 비면 그릴 표지가 없으므로 건너뛴다
    const book = row.books;
    if (!book) continue;

    const owned = mine.get(row.book_id);
    const stage = (owned?.stage ?? null) as CharacterStage | null;

    for (const tag of book.tags) tagCount[tag] = (tagCount[tag] ?? 0) + 1;

    entries.push({
      bookId: row.book_id,
      bookTitle: book.title,
      coverUrl: book.cover_url,
      tags: book.tags,
      name: row.name,
      artSeed: row.art_seed,
      stage,
      // stage_names 는 정확히 3개라는 제약이 붙어 있지만(0014), 모자라면 이름으로 떨어진다
      stageName: stage === null ? null : (row.stage_names[stage] ?? row.name),
      obtainedAt: owned?.obtained_at ?? null,
      stars: stage === 2 ? (stars[row.book_id] ?? 1) : null,
    });
  }

  entries.sort(compare);

  return {
    entries,
    captured: entries.filter((e) => e.stage === 2).length,
    total: entries.length,
    tags: Object.entries(tagCount)
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "ko"))
      .map(([tag]) => tag),
  };
}

/**
 * GET /api/characters 의 본문 (spec §5b) — **가진 것만**.
 *
 * 화면(`/collection`)은 빈 칸까지 필요해서 loadCollection 을 그대로 쓰고,
 * 이 라우트는 보스전 통과 직후 "방금 진화했나" 를 확인하는 데 쓴다.
 * 그래서 계약은 shared 의 CharacterView 그대로 둔다.
 */
export async function loadMyCharacters(
  supabase: BookitClient,
  userId: string,
): Promise<CharacterView[]> {
  const { entries } = await loadCollection(supabase, userId);

  return entries
    .filter((e) => e.stage !== null)
    .map((e) => ({
      book_id: e.bookId,
      book_title: e.bookTitle,
      cover_url: e.coverUrl,
      name: e.name,
      stage: e.stage as CharacterStage,
      stage_name: e.stageName ?? e.name,
      art_seed: e.artSeed,
      obtained_at: e.obtainedAt ?? "",
    }));
}
