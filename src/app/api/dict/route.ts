/**
 * GET /api/dict?word=  → { word, definition, source }
 *
 * 소유: 강민구 (docs/spec.md §5).
 * 얇게 유지한다 — 판단은 modules/reader 의 lookup 이 한다 (CLAUDE.md §2).
 *
 * 로그인 뒤에서만 연다. 열어두면 키가 붙은 사전 프록시가 되어
 * 하루 5만 건 한도를 아무나 태울 수 있다.
 */
import type { NextRequest, NextResponse } from "next/server";

import { DictError, lookup } from "@/modules/reader/server";
import { fail, ok, serverError, unauthorized } from "@/shared/api";
import { createServerSupabase } from "@/shared/supabase/server";
import type { ApiResponse, DictResponse } from "@/shared/types";

export async function GET(
  request: NextRequest,
): Promise<NextResponse<ApiResponse<DictResponse>>> {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return unauthorized();

  const word = request.nextUrl.searchParams.get("word") ?? "";

  try {
    return ok(await lookup(word));
  } catch (error) {
    if (error instanceof DictError) {
      // not_found 는 정상 흐름이다. 아이가 사전에 없는 말을 누른 것뿐이라
      // 서버 로그를 남기지 않는다.
      if (error.kind === "not_found") return fail("not_found", error.message, 404);
      return serverError("api/dict", error);
    }
    return serverError("api/dict", error);
  }
}
