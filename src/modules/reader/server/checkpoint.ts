/**
 * reader/server/checkpoint — 장 끝 한 문항의 수명. owner: 강민구
 *
 * 9/18 마감 스프린트(docs/sprint-0918.md) ③ · spec §2b·§5b:
 *   POST /api/checkpoints              { book_id, chapter_no } → { checkpoint_id, question }
 *   POST /api/checkpoints/:id/answer   { answer }              → { passed, feedback, character_stage }
 *
 * 질문·판정 자체는 ai 모듈(AI #6)이 한다. 여기가 책임지는 것은 네 가지다.
 *   1. 그 장을 실제로 읽었는가 — reading_progress 에 행이 있어야 문항이 나온다
 *   2. 같은 장에는 같은 문항 — 0014 의 unique (student_id, book_id, chapter_no)
 *   3. 쓰기는 service role 로 — checkpoints 에는 학생 insert/update 정책이 없다 (0014)
 *   4. 판정 뒤 캐릭터 단계를 되읽어 화면에 넘기기 — 올리는 것은 트리거다
 *
 * 왜 reader 인가: 문항이 뜨는 자리가 리더 화면이고, 근거가 그 장 본문이다
 * (본문 접근은 RLS 로 이 모듈이 이미 하고 있다). 화면(CheckpointPanel)은 박재경 소관이다.
 *
 * 검증과 섞이지 않는다 — 책갈피도, 제한 시간도, 재시도 규칙도 없다 (spec §2b).
 */
import "server-only";

import { askCheckpoint, judgeCheckpoint, type ChapterContext } from "@/modules/ai";
import type { BookitClient } from "@/shared/supabase";
import { createAdminClient } from "@/shared/supabase/admin";
import type {
  AnswerCheckpointResponse,
  CharacterStage,
  CreateCheckpointResponse,
  GradeLevel,
} from "@/shared/types";

/** 라우트가 그대로 fail() 로 넘길 수 있는 모양 */
export type CheckpointResult<T> =
  | { ok: true; data: T }
  | { ok: false; code: string; message: string; status: number };

function failure(code: string, message: string, status: number): CheckpointResult<never> {
  return { ok: false, code, message, status };
}

/** 그 장 본문 + 책 제목. 읽을 수 없는 책이면 null — 판단은 RLS 가 한다 (chapter.ts) */
async function loadChapter(
  supabase: BookitClient,
  bookId: string,
  chapterNo: number,
): Promise<ChapterContext | null> {
  const [chapter, book] = await Promise.all([
    supabase
      .from("book_contents")
      .select("title, body")
      .eq("book_id", bookId)
      .eq("chapter_no", chapterNo)
      .maybeSingle(),
    supabase.from("books").select("title").eq("id", bookId).maybeSingle(),
  ]);

  if (chapter.error) throw chapter.error;
  if (book.error) throw book.error;
  if (!chapter.data || !book.data) return null;

  return {
    bookTitle: book.data.title,
    chapterNo,
    title: chapter.data.title,
    body: chapter.data.body,
  };
}

/** 그 학생의 학년. 문항 크기를 맞추는 데만 쓴다. 모르면 그냥 빠진다 */
async function readGrade(
  supabase: BookitClient,
  userId: string,
): Promise<GradeLevel | undefined> {
  const { data } = await supabase
    .from("profiles")
    .select("grade_level")
    .eq("id", userId)
    .maybeSingle();

  return data?.grade_level ?? undefined;
}

/**
 * 그 장의 문항을 준다. 이미 만들어 둔 것이 있으면 그것을 그대로 준다.
 *
 * 다시 눌렀을 때 질문이 바뀌면 아이가 헷갈린다. 검증과 달리 여기서 새 질문을 만드는 것은
 * 부정행위를 막는 장치가 아니다 (CLAUDE.md §6 은 검증에만 걸린다).
 */
export async function openCheckpoint(
  supabase: BookitClient,
  userId: string,
  bookId: string,
  chapterNo: number,
): Promise<CheckpointResult<CreateCheckpointResponse>> {
  const existing = await supabase
    .from("checkpoints")
    .select("id, question")
    .eq("student_id", userId)
    .eq("book_id", bookId)
    .eq("chapter_no", chapterNo)
    .maybeSingle();

  if (existing.error) throw existing.error;
  if (existing.data) {
    return {
      ok: true,
      data: { checkpoint_id: existing.data.id, question: existing.data.question },
    };
  }

  // 읽지 않은 장의 문항은 만들지 않는다. 진행 기록은 리더가 장 끝에서 남긴다
  // (POST /api/reading/progress). 이 확인이 없으면 목록에서 아무 장이나 골라
  // 문항만 받아 캐릭터를 부화시킬 수 있다
  const read = await supabase
    .from("reading_progress")
    .select("chapter_no", { count: "exact", head: true })
    .eq("student_id", userId)
    .eq("book_id", bookId)
    .eq("chapter_no", chapterNo);

  if (read.error) throw read.error;
  if ((read.count ?? 0) === 0) {
    return failure("not_read_yet", "이 장을 먼저 읽고 오면 물어볼게.", 409);
  }

  const chapter = await loadChapter(supabase, bookId, chapterNo);
  if (!chapter) return failure("not_found", "이 책은 아직 읽을 수 없어.", 404);

  const { question } = await askCheckpoint(chapter, {
    gradeLevel: await readGrade(supabase, userId),
  });

  // 학생 권한으로는 넣을 수 없다 (0014 에 insert 정책이 없다). 질문은 AI 가 만든 것이고
  // 학생이 고쳐 쓸 수 있으면 판정이 의미를 잃는다 — verifications 와 같은 이유다
  const inserted = await createAdminClient()
    .from("checkpoints")
    .insert({ student_id: userId, book_id: bookId, chapter_no: chapterNo, question })
    .select("id")
    .single();

  if (inserted.error) throw inserted.error;

  return { ok: true, data: { checkpoint_id: inserted.data.id, question } };
}

/** 답을 판정하고 기록한다. 통과하면 트리거가 캐릭터를 부화시킨다 (0014) */
export async function answerCheckpoint(
  supabase: BookitClient,
  userId: string,
  checkpointId: string,
  answer: string,
): Promise<CheckpointResult<AnswerCheckpointResponse>> {
  const { data: row, error } = await supabase
    .from("checkpoints")
    .select("id, student_id, book_id, chapter_no, question, answered_at")
    .eq("id", checkpointId)
    .maybeSingle();

  if (error) throw error;
  // RLS 가 남의 행을 걸러내므로 "없음" 과 "남의 것" 이 같은 응답이 된다. 의도한 것이다
  if (!row || row.student_id !== userId) {
    return failure("checkpoint_not_found", "그 문항을 찾을 수 없어.", 404);
  }
  if (row.answered_at !== null) {
    return failure("already_answered", "이 문항은 이미 답했어.", 409);
  }

  const chapter = await loadChapter(supabase, row.book_id, row.chapter_no);
  if (!chapter) return failure("not_found", "이 책은 아직 읽을 수 없어.", 404);

  const judged = await judgeCheckpoint(chapter, row.question, answer, {
    gradeLevel: await readGrade(supabase, userId),
  });

  // answer 와 answered_at 은 함께여야 한다 (0014 의 answered_together 제약)
  const updated = await createAdminClient()
    .from("checkpoints")
    .update({
      answer,
      passed: judged.passed,
      feedback: judged.feedback,
      answered_at: new Date().toISOString(),
    })
    .eq("id", row.id)
    .select("id")
    .single();

  if (updated.error) throw updated.error;

  return {
    ok: true,
    data: {
      passed: judged.passed,
      feedback: judged.feedback,
      character_stage: await readStage(supabase, userId, row.book_id),
    },
  };
}

/** 트리거가 올려 둔 단계. 캐릭터가 없는 책이면 null (spec §2b) */
async function readStage(
  supabase: BookitClient,
  userId: string,
  bookId: string,
): Promise<CharacterStage | null> {
  const { data } = await supabase
    .from("student_characters")
    .select("stage")
    .eq("student_id", userId)
    .eq("book_id", bookId)
    .maybeSingle();

  return (data?.stage ?? null) as CharacterStage | null;
}
