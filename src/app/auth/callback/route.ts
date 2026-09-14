/**
 * 구글 OAuth 콜백.
 *
 * 소유: 김민경 (CLAUDE.md §3).
 *
 * 브라우저가 signInWithOAuth 로 떠났다가 ?code= 를 들고 여기로 돌아온다.
 * 여기서 코드를 세션으로 바꾸고 쿠키를 심는다. 이 경로는 미들웨어 matcher 에서 빠져 있다 —
 * 끼어들면 쿠키를 심기 전에 /login 으로 튕긴다.
 *
 * 끝나면 "/" 로 보낸다. 학생/교사/온보딩 판단은 미들웨어의 표가 이미 갖고 있으니
 * 여기서 같은 규칙을 두 번 쓰지 않는다.
 *
 * 리다이렉트 주소는 NEXT_PUBLIC_SITE_URL 이 아니라 요청이 들어온 origin 을 쓴다.
 * 세션 쿠키는 요청 도메인에 심기므로, 프리뷰 배포에서 로그인했는데 프로덕션 주소로
 * 보내 버리면 쿠키 없는 곳에 떨어져 다시 /login 으로 튕긴다.
 */

import { NextResponse, type NextRequest } from "next/server";

import { createServerSupabase } from "@/shared/supabase/server";

/**
 * 브라우저가 실제로 접속한 origin. Vercel 은 프록시 뒤라 request.url 의 host 가
 * 내부 주소일 수 있어 x-forwarded-* 를 먼저 본다.
 */
function requestOrigin(request: NextRequest): string {
  const host =
    request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  const proto = request.headers.get("x-forwarded-proto") ?? "https";
  return host ? `${proto}://${host}` : request.nextUrl.origin;
}

function backToLogin(request: NextRequest, reason: string): NextResponse {
  const url = new URL("/login", requestOrigin(request));
  url.searchParams.set("error", reason);
  return NextResponse.redirect(url);
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const code = request.nextUrl.searchParams.get("code");
  const oauthError = request.nextUrl.searchParams.get("error");

  // 사용자가 구글 동의 화면에서 취소한 경우도 여기로 온다
  if (oauthError) return backToLogin(request, oauthError);
  if (!code) return backToLogin(request, "missing_code");

  const supabase = await createServerSupabase();
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);

  if (error || !data.user) {
    console.error("[auth/callback] 세션 교환 실패", error);
    return backToLogin(request, "exchange_failed");
  }

  const metadata = data.user.user_metadata as {
    full_name?: string;
    name?: string;
  };
  const displayName = metadata.full_name ?? metadata.name ?? "친구";

  /**
   * profiles 행을 여기서 만든다. 구글 이름은 이 시점에만 손에 들어온다.
   * role 은 기본값 'student' 로 들어가고, 온보딩에서 교사를 고르면 그때 바뀐다.
   * onConflict 로 display_name 만 갱신한다 — role 과 grade_level 은 건드리지 않는다.
   */
  const { error: profileError } = await supabase
    .from("profiles")
    .upsert({ id: data.user.id, display_name: displayName }, { onConflict: "id" });

  if (profileError) {
    console.error("[auth/callback] profiles 생성 실패", profileError);
    return backToLogin(request, "profile_failed");
  }

  return NextResponse.redirect(new URL("/", requestOrigin(request)));
}
