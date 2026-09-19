/**
 * GET /api/reader/:bookId/lengths  → number[]  (장마다 글자 수, 1장부터)
 *
 * 소유: 강민구 — 낱말 퀴즈(AI #8, 2026-09-19)를 쪽 기준 25·50·75% 에 띄우려고 화면이
 * 책 전체 쪽 수를 어림한다. 본문은 내려보내지 않고 숫자만. 읽을 권한은 RLS 가 판단한다.
 */
import type { NextRequest, NextResponse } from "next/server";

import { chapterLengths } from "@/modules/reader/server";
import { ok, serverError, unauthorized } from "@/shared/api";
import { createServerSupabase } from "@/shared/supabase/server";
import type { ApiResponse } from "@/shared/types";

export async function GET(
  _request: NextRequest,
  context: RouteContext<"/api/reader/[bookId]/lengths">,
): Promise<NextResponse<ApiResponse<number[]>>> {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return unauthorized();

  const { bookId } = await context.params;
  try {
    return ok(await chapterLengths(supabase, bookId));
  } catch (error) {
    return serverError("api/reader/lengths", error);
  }
}
