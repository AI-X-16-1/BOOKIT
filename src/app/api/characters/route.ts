/**
 * GET /api/characters → { characters[] }
 *
 * docs/spec.md §5b (게임화). 조회는 modules/verification 이 한다 — 라우트는 얇게 (CLAUDE.md §2).
 *
 * 가진 캐릭터만 내려준다. 보스전 통과 직후 화면이 "방금 최종 진화했나" 를 확인하는 자리다 —
 * 진화는 0014 트리거가 검증 응답과 별개로 이미 올려 둔 뒤라 여기서 다시 계산하지 않는다.
 * 도감 화면(/collection)은 빈 칸까지 필요해서 서버 컴포넌트가 직접 읽는다.
 */

import type { NextResponse } from "next/server";

import { loadMyCharacters } from "@/modules/verification/server";
import { ok, serverError, unauthorized } from "@/shared/api";
import { createServerSupabase } from "@/shared/supabase/server";
import type { ApiResponse, CharactersResponse } from "@/shared/types";

export async function GET(): Promise<NextResponse<ApiResponse<CharactersResponse>>> {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return unauthorized();

  try {
    return ok({ characters: await loadMyCharacters(supabase, user.id) });
  } catch (cause) {
    return serverError("characters", cause);
  }
}
