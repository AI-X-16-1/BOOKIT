/**
 * GET /auth/demo?as=student|teacher — 심사위원용 시연 로그인.
 *
 * 소유: 김민경 (CLAUDE.md §3). 왜·언제까지는 modules/auth/server/demo.ts 주석.
 *
 * /auth 는 미들웨어 matcher 에서 빠져 있어 로그인 상태와 무관하게 닿는다.
 * 이미 다른 계정으로 들어와 있으면 먼저 로그아웃하고 데모 계정으로 바꾼다 —
 * 심사자가 학생 → 교사로 옮겨 다닐 수 있어야 한다.
 *
 * 끝나면 "/" 로 보낸다. 학생/교사 판단은 미들웨어의 표가 한다 (콜백과 같다).
 */

import { NextResponse, type NextRequest } from "next/server";

import { demoEmailFor, demoLoginEnabled, parseDemoRole } from "@/modules/auth";
import { createAdminClient } from "@/shared/supabase/admin";
import { createServerSupabase } from "@/shared/supabase/server";

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
  // 꺼져 있으면 경로가 없는 것처럼 군다 — 심사 뒤에 남는 뒷문이 아니어야 한다
  if (!demoLoginEnabled()) {
    return NextResponse.json({ error: { code: "not_found" } }, { status: 404 });
  }

  const role = parseDemoRole(request.nextUrl.searchParams.get("as"));
  if (!role) return backToLogin(request, "demo_role");

  const email = demoEmailFor(role);

  // 토큰은 이 요청 안에서만 산다. 메일은 보내지 않는다
  const admin = createAdminClient();
  const { data, error } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email,
  });
  if (error || !data.properties?.hashed_token) {
    console.error("[auth/demo] 토큰 생성 실패", error);
    return backToLogin(request, "demo_failed");
  }

  const supabase = await createServerSupabase();
  await supabase.auth.signOut();

  const verified = await supabase.auth.verifyOtp({
    token_hash: data.properties.hashed_token,
    type: "magiclink",
  });
  if (verified.error || !verified.data.user) {
    console.error("[auth/demo] 세션 발급 실패", verified.error);
    return backToLogin(request, "demo_failed");
  }

  return NextResponse.redirect(new URL("/", requestOrigin(request)));
}
