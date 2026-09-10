/**
 * 미들웨어용 Supabase 클라이언트 + 세션 갱신.
 *
 * 소유: 김민경 (CLAUDE.md §2).
 *
 * 서버 컴포넌트는 쿠키를 쓸 수 없으니, 만료된 액세스 토큰을 갱신해서
 * 요청·응답 양쪽 쿠키에 다시 심는 건 미들웨어의 일이다.
 *
 * 역할 분기(학생 → /home, 교사 → /teacher, 온보딩 미완 → /onboarding)는
 * 여기가 아니라 src/middleware.ts 에서 이 함수의 반환값을 보고 정한다.
 * 이 파일은 클라이언트 생성과 쿠키 왕복만 담당한다.
 */

import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { User } from "@supabase/supabase-js";

import type { Database } from "./database.types";
import { publicSupabaseEnv } from "./env";

export interface SessionUpdate {
  /** 갱신된 인증 쿠키가 실린 응답. 미들웨어는 이 객체를 그대로 반환해야 한다 */
  response: NextResponse;
  /** 미로그인이면 null */
  user: User | null;
}

export async function updateSession(
  request: NextRequest,
): Promise<SessionUpdate> {
  const { url, anonKey } = publicSupabaseEnv();

  let response = NextResponse.next({ request });

  const supabase = createServerClient<Database>(url, anonKey, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (cookiesToSet) => {
        // 요청 쪽에 먼저 심어야 이 요청을 처리하는 서버 컴포넌트가 새 토큰을 본다.
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value);
        }
        // 응답을 다시 만들어야 헤더에 Set-Cookie 가 붙는다.
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
      },
    },
  });

  // 이 호출이 토큰 갱신을 일으킨다. 빼면 세션이 조용히 만료된다.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return { response, user };
}
