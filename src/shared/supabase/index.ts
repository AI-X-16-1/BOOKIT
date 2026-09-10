/**
 * src/shared/supabase 의 안내문.
 *
 * 소유: 김민경. 다른 오너 세션에서 고치지 말고 요청할 것 (CLAUDE.md §2).
 *
 * 여기서는 타입만 re-export 한다. 런타임 클라이언트는 실행 환경이 달라서
 * 한 배럴로 묶으면 안 된다 — server.ts 는 next/headers 를, admin.ts 는 server-only 를
 * import 하므로 클라이언트 번들에 섞이는 순간 빌드가 깨진다.
 *
 * 쓰는 곳에 맞춰 직접 import 한다:
 *
 *   클라이언트 컴포넌트   import { createClient }         from "@/shared/supabase/client";
 *   서버 컴포넌트·핸들러   import { createServerSupabase } from "@/shared/supabase/server";
 *   미들웨어               import { updateSession }        from "@/shared/supabase/middleware";
 *   보호자 라우트·스크립트 import { createAdminClient }     from "@/shared/supabase/admin";
 */

export type { Database } from "./database.types";
export type { BookitClient } from "./client";
