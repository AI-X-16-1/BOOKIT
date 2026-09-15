/**
 * POST /auth/signout — 세션 쿠키를 지우고 로그인 화면으로.
 *
 * 소유: 김민경 (CLAUDE.md §3).
 *
 * /auth 는 미들웨어 matcher 에서 빠져 있어(콜백과 같은 이유) 상태와 무관하게 닿는다.
 * GET 이 아니라 POST 다 — 링크 프리페치나 크롤러가 실수로 로그아웃시키지 않게.
 * 리다이렉트 주소는 콜백과 같은 이유로 요청 origin 을 쓴다.
 */

import { NextResponse, type NextRequest } from "next/server";

import { createServerSupabase } from "@/shared/supabase/server";

function requestOrigin(request: NextRequest): string {
  const host =
    request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  const proto = request.headers.get("x-forwarded-proto") ?? "https";
  return host ? `${proto}://${host}` : request.nextUrl.origin;
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const supabase = await createServerSupabase();
  const { error } = await supabase.auth.signOut();
  if (error) console.error("[auth/signout] 로그아웃 실패", error);

  // 303 — POST 뒤 GET 으로 바꿔서 보낸다
  return NextResponse.redirect(new URL("/login", requestOrigin(request)), 303);
}
