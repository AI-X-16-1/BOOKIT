/**
 * reader/server/quiz — 낱말 퀴즈 한 문제의 지문 고르기. owner: 강민구
 *
 * 문제 자체는 ai 모듈(AI #8 makeWordQuiz)이 만든다. 여기는 "방금 읽은 대목" 을 잘라 넘긴다 —
 * 지금 펼친 쪽 앞까지의 원문 끝부분. 새 장 첫 쪽이면 앞 장의 끝이다.
 *
 * 아무것도 저장하지 않는다. 책갈피도 기록도 없는 놀이라 테이블이 없다 (spec §2b 불변 —
 * 책갈피는 검증 통과에서만). 본문은 RLS 로 읽을 수 있는 책만 나온다 (서재 = 저작권 만료).
 * 아이가 쓴 것은 하나도 모델로 가지 않는다 — 책 원문과 학년뿐이다.
 */
import "server-only";

import { makeWordQuiz, type WordQuiz } from "@/modules/ai";
import type { BookitClient } from "@/shared/supabase";
import type { GradeLevel } from "@/shared/types";

import { wordOffset } from "../readAlong";
import { readMyGrade } from "./shelf";

/** 지문이 이보다 짧으면 문제를 안 낸다 — 고를 낱말이 모자라 뻔한 문제가 나온다 */
const MIN_PASSAGE_CHARS = 200;
/** 방금 읽은 한두 쪽 */
const PASSAGE_CHARS = 1_500;

async function chapterBody(
  supabase: BookitClient,
  bookId: string,
  chapterNo: number,
): Promise<string | null> {
  const { data, error } = await supabase
    .from("book_contents")
    .select("body")
    .eq("book_id", bookId)
    .eq("chapter_no", chapterNo)
    .maybeSingle();
  if (error) throw error;
  return data?.body ?? null;
}

/**
 * 퀴즈 한 문제. 낼 수 없으면 null — 지문이 짧거나, 모델이 쓸 수 없는 문제를 냈거나.
 * 화면은 null 이면 조용히 넘어간다 (읽기를 막을 일이 아니다)
 */
export async function openWordQuiz(
  supabase: BookitClient,
  userId: string,
  bookId: string,
  chapterNo: number,
  uptoWord: number,
): Promise<WordQuiz | null> {
  const [book, body] = await Promise.all([
    supabase.from("books").select("title").eq("id", bookId).maybeSingle(),
    chapterBody(supabase, bookId, chapterNo),
  ]);
  if (book.error) throw book.error;
  if (!book.data || body === null) return null;

  let passage = body.slice(0, wordOffset(body, uptoWord));
  // 새 장 첫 쪽 — 방금 읽은 것은 앞 장의 끝이다
  if (passage.trim().length < MIN_PASSAGE_CHARS && chapterNo > 1) {
    passage = (await chapterBody(supabase, bookId, chapterNo - 1)) ?? "";
  }
  passage = passage.slice(-PASSAGE_CHARS).trim();
  if (passage.length < MIN_PASSAGE_CHARS) return null;

  const grade = await readMyGrade(supabase, userId);
  return makeWordQuiz(book.data.title, passage, grade ? { gradeLevel: grade as GradeLevel } : undefined);
}

/**
 * 장마다 글자 수 (1장부터 차례로). 낱말 퀴즈를 **쪽 기준** 25·50·75% 에 띄우려고 화면이
 * 책 전체 쪽 수를 어림하는 데 쓴다 — 지금 장의 "글자 수 ÷ 쪽 수" 로 나머지 장을 쪽으로 바꾼다.
 * 본문은 서버에서만 읽고 숫자만 내려보낸다. 읽을 수 없는 책이면 빈 배열 (RLS)
 */
export async function chapterLengths(
  supabase: BookitClient,
  bookId: string,
): Promise<number[]> {
  const { data, error } = await supabase
    .from("book_contents")
    .select("chapter_no, body")
    .eq("book_id", bookId)
    .order("chapter_no");
  if (error) throw error;
  return data.map((row) => row.body.length);
}

