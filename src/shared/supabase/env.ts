/**
 * Supabase 환경변수 읽기 — .env.example 과 1:1로 맞춘다.
 *
 * 소유: 김민경 (CLAUDE.md §2).
 *
 * NEXT_PUBLIC_ 값은 Next 가 빌드 시점에 문자열로 치환한다.
 * 그래서 process.env 를 변수로 돌려 읽으면 안 되고, 반드시 리터럴로 써야 한다.
 *
 * 전부 함수로 감싼 이유: 모듈 스코프에서 읽으면 값이 없을 때 import 만으로 빌드가 깨진다.
 * 특히 SUPABASE_SERVICE_ROLE_KEY 는 CI 에 넣지 않으므로 (.github/workflows/ci.yml)
 * 반드시 호출 시점에 읽어야 한다.
 */

function required(name: string, value: string | undefined): string {
  if (!value) {
    throw new Error(
      `환경변수 ${name} 가 비어 있다. .env.example 을 보고 .env.local 을 채운다.`,
    );
  }
  return value;
}

/** 브라우저 번들에 들어가도 되는 값. anon key 는 RLS 아래에서만 동작한다 */
export function publicSupabaseEnv(): { url: string; anonKey: string } {
  return {
    url: required(
      "NEXT_PUBLIC_SUPABASE_URL",
      process.env.NEXT_PUBLIC_SUPABASE_URL,
    ),
    anonKey: required(
      "NEXT_PUBLIC_SUPABASE_ANON_KEY",
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    ),
  };
}

/**
 * RLS 를 통째로 우회하는 키다. 서버에서만, 그것도 admin.ts 안에서만 읽는다.
 * 보호자 링크 조회처럼 인증 없는 경로에서만 쓴다 (docs/spec.md §3).
 */
export function serviceRoleKey(): string {
  return required(
    "SUPABASE_SERVICE_ROLE_KEY",
    process.env.SUPABASE_SERVICE_ROLE_KEY,
  );
}

/** OAuth 리다이렉트와 보호자 공유 링크의 절대 주소 */
export function siteUrl(): string {
  return required("NEXT_PUBLIC_SITE_URL", process.env.NEXT_PUBLIC_SITE_URL);
}
