/**
 * 서버용 Supabase 클라이언트 — 서버 컴포넌트와 Route Handler 가 같이 쓴다.
 *
 * 소유: 김민경 (CLAUDE.md §2).
 *
 * 로그인한 사용자로 동작하므로 RLS 가 그대로 걸린다. 그게 기본값이고,
 * RLS 를 우회해야 하는 건 보호자 링크 하나뿐이다 — 그건 ./admin 을 쓴다 (docs/spec.md §3).
 *
 * next/headers 를 import 하므로 클라이언트 컴포넌트에서는 쓸 수 없다.
 * 그래서 ./index 배럴에서 이 파일을 re-export 하지 않는다.
 */

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

import type { BookitClient } from "./client";
import type { Database } from "./database.types";
import { publicSupabaseEnv } from "./env";

export type { BookitClient };

/**
 * Next 15+ 에서 cookies() 는 Promise 라 반드시 await 한다.
 * 호출하는 쪽도 async 여야 한다.
 */
export async function createServerSupabase(): Promise<BookitClient> {
  const { url, anonKey } = publicSupabaseEnv();
  const cookieStore = await cookies();

  return createServerClient<Database>(url, anonKey, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (cookiesToSet) => {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // 서버 컴포넌트 렌더 중에는 쿠키를 쓸 수 없다 (Next 가 막는다).
          // 토큰 갱신은 미들웨어가 책임진다 — ./middleware 의 updateSession.
          // Route Handler 에서는 이 set 이 정상 동작한다.
        }
      },
    },
  });
}

/**
 * 로그인 여부만 빠르게 확인할 때.
 * getSession() 은 쿠키를 그대로 믿으므로 쓰지 않는다 — getUser() 로 서버 검증한다.
 */
export async function getCurrentUser() {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}
