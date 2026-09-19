/**
 * POST /api/reading/quiz  { book_id, chapter_no, upto_word } → { word, sentence, choices, answer } | null
 *
 * 소유: 강민구 — 낱말 퀴즈 (AI #8, 2026-09-19). 서재에서 읽는 도중에 뜨는 미니게임.
 * 얇게 유지한다 — 지문 고르기는 modules/reader/server 의 openWordQuiz 가 한다 (CLAUDE.md §2).
 *
 * 저장하지 않고 책갈피와도 무관하다 (spec §2b). 로그인한 사람만 — LLM 호출이라서다.
 * 낼 수 없는 문제면 data 가 null 이다 (오류가 아니다 — 화면은 그냥 넘어간다).
 */
import type { NextRequest, NextResponse } from "next/server";

import { wordQuizRequestSchema, type WordQuizResponse } from "@/modules/reader";
import { openWordQuiz } from "@/modules/reader/server";
import { invalidBody, ok, readJson, serverError, unauthorized } from "@/shared/api";
import { createServerSupabase } from "@/shared/supabase/server";
import type { ApiResponse } from "@/shared/types";

export async function POST(
  request: NextRequest,
): Promise<NextResponse<ApiResponse<WordQuizResponse | null>>> {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return unauthorized();

  const parsed = wordQuizRequestSchema.safeParse(await readJson(request));
  if (!parsed.success) return invalidBody("어디를 읽고 있는지 알 수 없어.");

  try {
    return ok(
      await openWordQuiz(
        supabase,
        user.id,
        parsed.data.book_id,
        parsed.data.chapter_no,
        parsed.data.upto_word,
        parsed.data.avoid,
      ),
    );
  } catch (cause) {
    return serverError("api/reading/quiz", cause);
  }
}
