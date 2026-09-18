/**
 * reader/server/progress — 장을 다 읽으면 남기는 기록. owner: 강민구
 *
 * 9/18 마감 스프린트 ① (docs/sprint-0918.md, spec §2b·§5b). 이 한 줄이 세 화면의 재료다:
 *   - 표지 퍼즐 조각 — 읽은 장 수 / 그 책의 전체 장 수 (review 의 CoverPuzzle, #140)
 *   - 캐릭터 알(stage 0)과 부화(stage 1) — 0014 의 reading_progress_character 트리거
 *   - 도감의 "읽는 중" 칸 (verification 의 CollectionScreen, #141)
 *
 * 쓰는 쪽만 여기 있다. 진행률을 **읽는** 쪽은 박재경이 review/server/reading.ts 에 뒀다 —
 * 퍼즐을 그리는 화면이 그쪽이기 때문이다. 같은 테이블을 보지만 방향이 다르다.
 *
 * 진화 단계는 여기서 계산하지 않는다. 0014 트리거가 올려둔 값을 되읽어 돌려줄 뿐이다 —
 * stage 를 두 군데서 정하면 한쪽만 고쳐질 때 어긋난다 (chapter.ts 의 RLS 주석과 같은 이유).
 *
 * 책갈피는 여기서 나오지 않는다 (§4 불변). 그래서 쪽을 빨리 넘겨 조각을 채우는 건
 * 막지 않는다 — 얻는 것이 퍼즐과 부화뿐이라 그럴 이유가 크지 않고, 막으려면 읽은 시간을
 * 재야 하는데 그건 아이 화면에 스톱워치를 하나 더 붙이는 일이다.
 */
import "server-only";

import type { BookitClient } from "@/shared/supabase";
import type { CharacterStage, ReadingProgressResponse } from "@/shared/types";

import { ChapterError } from "./chapter";

/**
 * 그 장을 읽었다고 적고, 퍼즐 진행률과 (트리거가 올렸으면) 새 캐릭터 단계를 돌려준다.
 *
 * 같은 장을 다시 읽어도 안전하다 — 중복은 조용히 무시한다 (on conflict do nothing).
 * 그때는 트리거도 돌지 않으므로 stage 는 그대로다.
 *
 * 없는 장이거나 저작권이 살아 있는 책이면 ChapterError("not_found") 다. 본문 조회와 같은
 * 판단을 RLS 에 맡기고, 여기서 한 번 더 확인해서 서재 밖 책에 기록이 생기지 않게 한다.
 */
export async function recordChapterRead(
  supabase: BookitClient,
  studentId: string,
  bookId: string,
  chapterNo: number,
): Promise<ReadingProgressResponse> {
  // 읽을 수 있는 장인지 먼저 본다. RLS 가 저작권 있는 책의 본문을 내주지 않으므로
  // 이 조회가 비면 "없는 장" 과 "읽을 수 없는 책" 둘 중 하나다 — 구분해 알려주지 않는다
  const { data: chapter, error: chapterError } = await supabase
    .from("book_contents")
    .select("chapter_no")
    .eq("book_id", bookId)
    .eq("chapter_no", chapterNo)
    .maybeSingle();

  if (chapterError) {
    throw new ChapterError("upstream", "읽은 곳을 저장하지 못했다.", {
      cause: chapterError,
    });
  }
  if (!chapter) {
    throw new ChapterError("not_found", "이 책은 아직 읽을 수 없어.");
  }

  const { error: insertError } = await supabase.from("reading_progress").upsert(
    { student_id: studentId, book_id: bookId, chapter_no: chapterNo },
    { onConflict: "student_id,book_id,chapter_no", ignoreDuplicates: true },
  );

  if (insertError) {
    throw new ChapterError("upstream", "읽은 곳을 저장하지 못했다.", {
      cause: insertError,
    });
  }

  return readPuzzle(supabase, studentId, bookId);
}

/**
 * 퍼즐 상태와 캐릭터 단계. 저장된 진행률 칸은 없다 — 셀 수 있는 것은 세서 쓴다
 * (points_ledger 를 합산하는 것과 같은 이유, CLAUDE.md §4).
 */
async function readPuzzle(
  supabase: BookitClient,
  studentId: string,
  bookId: string,
): Promise<ReadingProgressResponse> {
  const [read, total, character] = await Promise.all([
    supabase
      .from("reading_progress")
      .select("chapter_no", { count: "exact", head: true })
      .eq("student_id", studentId)
      .eq("book_id", bookId),
    supabase
      .from("book_contents")
      .select("chapter_no", { count: "exact", head: true })
      .eq("book_id", bookId),
    // 캐릭터가 없는 책(검색으로 들어온 책)이면 행이 없다 — 그때는 null 이다
    supabase
      .from("student_characters")
      .select("stage")
      .eq("student_id", studentId)
      .eq("book_id", bookId)
      .maybeSingle(),
  ]);

  const failure = read.error ?? total.error ?? character.error;
  if (failure) {
    throw new ChapterError("upstream", "읽은 곳을 저장하지 못했다.", {
      cause: failure,
    });
  }

  return {
    read_chapters: read.count ?? 0,
    total_chapters: total.count ?? 0,
    character_stage: (character.data?.stage ?? null) as CharacterStage | null,
  };
}
