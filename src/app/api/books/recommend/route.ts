// src/app/api/books/recommend/route.ts
/**
 * GET /api/books/recommend → { books[], reason_tags[] }
 *
 * 소유: 이승환 (docs/spec.md §5).
 */
import type { NextResponse } from "next/server";

import {
  createSupabaseBooksReadPort,
  fail,
  ok,
  recommendBooks,
  unauthorized,
} from "@/modules/books/server";
import { createServerSupabase } from "@/shared/supabase/server";
import type { ApiResponse, BookRecommendResponse } from "@/shared/types";

export async function GET(): Promise<
  NextResponse<ApiResponse<BookRecommendResponse>>
> {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return unauthorized();

  try {
    const profile = await supabase
      .from("profiles")
      .select("grade_level")
      .eq("id", user.id)
      .single();
    if (profile.error || profile.data.grade_level === null) {
      return fail("profile_incomplete", "학년 정보를 먼저 등록해줘.", 409);
    }

    const port = createSupabaseBooksReadPort(supabase);
    const { books, reasonTags } = await recommendBooks(
      port,
      profile.data.grade_level,
    );
    return ok({ books, reason_tags: reasonTags });
  } catch {
    return fail(
      "internal_error",
      "지금은 잘 안 되네. 조금 뒤에 다시 해볼래?",
      500,
    );
  }
}
