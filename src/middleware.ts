/**
 * 세션 갱신 + 역할 분기.
 *
 * 소유: 김민경 (CLAUDE.md §3 — auth).
 *
 * 얇게 유지한다. 상태 해석은 modules/auth 의 resolveAccess,
 * 목적지 결정은 redirectTargetFor 가 한다. 여기는 집행만 한다.
 *
 * 서버 컴포넌트는 쿠키를 쓸 수 없으므로, 만료된 액세스 토큰을 갱신하는 건 이 파일뿐이다.
 */

import { NextResponse, type NextRequest } from "next/server";

import { isPublicPath, redirectTargetFor, resolveAccess } from "@/modules/auth";
import { updateSession } from "@/shared/supabase/middleware";

export async function middleware(request: NextRequest) {
  const { response, user, supabase } = await updateSession(request);
  const { pathname } = request.nextUrl;

  // 미로그인 + 공개 경로면 DB 를 읽을 이유가 없다. 모든 요청에 질의가 붙지 않게 먼저 걸러낸다
  if (!user && isPublicPath(pathname)) return response;

  const access = await resolveAccess(supabase, user);
  const target = redirectTargetFor(access, pathname);
  if (!target) return response;

  const url = request.nextUrl.clone();
  url.pathname = target;
  url.search = "";

  const redirect = NextResponse.redirect(url);
  // 갱신된 인증 쿠키를 리다이렉트 응답으로 옮긴다. 빼먹으면 방금 갱신한 토큰이 날아간다
  for (const cookie of response.cookies.getAll()) {
    redirect.cookies.set(cookie);
  }
  return redirect;
}

export const config = {
  /**
   * 정적 파일과 OAuth 콜백, Route Handler 는 제외한다.
   * 콜백(/auth/...)은 스스로 쿠키를 심어야 하고, API 는 스스로 인증한다.
   */
  matcher: [
    "/((?!_next/static|_next/image|api/|auth/|favicon.ico|manifest.webmanifest|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|txt)$).*)",
  ],
};
