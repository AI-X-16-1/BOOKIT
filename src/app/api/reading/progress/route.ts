/**
 * POST /api/reading/progress  { book_id, chapter_no }
 *   → { read_chapters, total_chapters, character_stage }
 *
 * 소유: 강민구 (docs/spec.md §5b, docs/sprint-0918.md ①).
 * 서재에서 한 장을 끝까지 읽으면 리더가 부른다. 얇게 유지한다 —
 * 판단은 modules/reader/server 의 recordChapterRead 가 한다 (CLAUDE.md §2).
 *
 * 책갈피와는 무관하다. 검증 통과만 책갈피를 준다 (§4 불변).
 */
import type { NextRequest, NextResponse } from "next/server";

import { readingProgressSchema } from "@/modules/reader";
import { ChapterError, recordChapterRead } from "@/modules/reader/server";
import {
  fail,
  invalidBody,
  ok,
  readJson,
  serverError,
  unauthorized,
} from "@/shared/api";
import { createServerSupabase } from "@/shared/supabase/server";
import type { ApiResponse, ReadingProgressResponse } from "@/shared/types";

export async function POST(
  request: NextRequest,
): Promise<NextResponse<ApiResponse<ReadingProgressResponse>>> {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return unauthorized();

  const parsed = readingProgressSchema.safeParse(await readJson(request));
  if (!parsed.success) return invalidBody("어디까지 읽었는지 알 수 없어.");

  try {
    return ok(
      await recordChapterRead(
        supabase,
        user.id,
        parsed.data.book_id,
        parsed.data.chapter_no,
      ),
    );
  } catch (error) {
    if (error instanceof ChapterError && error.kind === "not_found") {
      return fail("not_found", error.message, 404);
    }
    return serverError("api/reading/progress", error);
  }
}
