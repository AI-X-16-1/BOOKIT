/**
 * service role 클라이언트 — RLS 를 통째로 우회한다.
 *
 * 소유: 김민경 (CLAUDE.md §2).
 *
 * 쓰는 곳은 둘뿐이다:
 *   1. GET /api/guardian/:token — 인증 없는 보호자 조회 (docs/spec.md §3)
 *   2. 시드·운영 스크립트
 *
 * 그 외에는 ./server 를 쓴다. 여기로 조회하면 "학생 본인만" 같은 정책이 전부 무효가 된다.
 *
 * 보호자 응답에 reviews.body 와 verifications.answer 를 절대 담지 않는다 (CLAUDE.md §5).
 * RLS 가 막아 주지 않으므로, 여기서는 타입(GuardianSummaryResponse)과 쿼리의 select 목록이
 * 유일한 방어선이다.
 */

import "server-only";

import { createClient } from "@supabase/supabase-js";

import type { BookitClient } from "./client";
import type { Database } from "./database.types";
import { publicSupabaseEnv, serviceRoleKey } from "./env";

export function createAdminClient(): BookitClient {
  const { url } = publicSupabaseEnv();

  return createClient<Database>(url, serviceRoleKey(), {
    auth: {
      // 서버에서 요청마다 새로 만든다. 세션을 들고 있을 이유가 없다.
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}
