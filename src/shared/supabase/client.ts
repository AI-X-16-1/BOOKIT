/**
 * 브라우저용 Supabase 클라이언트.
 *
 * 소유: 김민경 (CLAUDE.md §2).
 *
 * 클라이언트 컴포넌트에서만 쓴다. anon key 만 들고 있고, 보이는 행은 RLS 가 정한다.
 * LLM 호출과 외부 API 호출은 여기로 하지 않는다 — 전부 Route Handler 경유다 (CLAUDE.md §1).
 */

import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "./database.types";
import { publicSupabaseEnv } from "./env";

export type BookitClient = SupabaseClient<Database>;

/**
 * 탭 하나당 인스턴스 하나. 매번 새로 만들면 onAuthStateChange 구독이 겹치고
 * 토큰 갱신이 두 군데서 돌아 세션이 엉킨다.
 */
let browserClient: BookitClient | undefined;

export function createClient(): BookitClient {
  if (!browserClient) {
    const { url, anonKey } = publicSupabaseEnv();
    browserClient = createBrowserClient<Database>(url, anonKey);
  }
  return browserClient;
}
