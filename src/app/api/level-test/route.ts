/**
 * POST /api/level-test → { book_id, book_title, author, passage, questions[3] }
 *
 * 읽기 수준 진단 (AI #7). 소유: 박재경.
 *
 * 계약: docs/spec.md §5c.
 *
 * 얇게 유지한다 — 지문 고르기와 문항 생성은 modules/level 이 한다 (CLAUDE.md §2).
 * 책갈피·검증 테이블을 건드리지 않는다.
 */
import type { NextResponse } from "next/server";

import { startLevelTest } from "@/modules/level/server";
import { fail, ok, serverError, unauthorized } from "@/shared/api";
import { createServerSupabase } from "@/shared/supabase/server";
import type { ApiResponse } from "@/shared/types";

interface StartResponse {
  book_id: string;
  book_title: string;
  author: string;
  passage: string;
  questions: string[];
}

export async function POST(): Promise<NextResponse<ApiResponse<StartResponse>>> {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return unauthorized();

  try {
    const result = await startLevelTest(supabase, user.id);
    if (!result.ok) return fail(result.code, result.message, result.status);

    const { bookId, bookTitle, author, passage, questions } = result.data;
    return ok({ book_id: bookId, book_title: bookTitle, author, passage, questions });
  } catch (cause) {
    return serverError("level-test", cause);
  }
}
