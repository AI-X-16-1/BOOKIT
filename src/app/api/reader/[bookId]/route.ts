/**
 * GET /api/reader/:bookId?chapter=1  → { title, body }
 *
 * 소유: 강민구 (docs/spec.md §5).
 * 저작권 만료 도서만 열린다. 그 판단은 RLS 가 한다 (modules/reader/server/chapter.ts).
 */
import type { NextRequest, NextResponse } from "next/server";

import {
  ChapterError,
  getChapter,
  parseChapterNo,
} from "@/modules/reader/server";
import { fail, invalidBody, ok, serverError, unauthorized } from "@/shared/api";
import { createServerSupabase } from "@/shared/supabase/server";
import type { ApiResponse, ReaderChapterResponse } from "@/shared/types";

export async function GET(
  request: NextRequest,
  context: RouteContext<"/api/reader/[bookId]">,
): Promise<NextResponse<ApiResponse<ReaderChapterResponse>>> {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return unauthorized();

  const { bookId } = await context.params;
  const chapterNo = parseChapterNo(request.nextUrl.searchParams.get("chapter"));
  if (chapterNo === null) return invalidBody("몇 장을 읽을지 다시 알려줄래?");

  try {
    return ok(await getChapter(supabase, bookId, chapterNo));
  } catch (error) {
    if (error instanceof ChapterError && error.kind === "not_found") {
      return fail("not_found", error.message, 404);
    }
    return serverError("api/reader", error);
  }
}
