/**
 * 심사위원용 시연 로그인 — 구글 계정 없이 시드 계정으로 들어간다.
 *
 * 소유: 김민경 (CLAUDE.md §3).
 *
 * 왜 있나: 대회 규정상 심사자가 "별도 로그인 없이" 서비스에 들어갈 수 있어야 한다.
 * 구글 OAuth 만 쓰는 구조(CLAUDE.md §1)라 로그인 화면이 먼저 뜨고, 심사자에게 구글
 * 계정으로 가입해 반 코드까지 넣으라고 할 수는 없다. 그래서 시드의 데모 학생·교사
 * 계정(supabase/seed.sql)으로 바로 들어가는 문을 하나 둔다.
 *
 * 어떻게: 비밀번호 로그인을 켜지 않는다. service role 로 매직링크 토큰을 만들고
 * (generateLink) 그 자리에서 verifyOtp 로 세션을 심는다. 메일은 보내지 않고,
 * 토큰은 이 요청 안에서만 산다. 비밀번호도 토큰도 브라우저에 가지 않는다.
 *
 * 언제까지: DEMO_LOGIN_ENABLED=true 이고 DEMO_LOGIN_UNTIL 이 지나지 않았을 때만.
 * 데모데이(2026-10-17) 뒤에는 env 를 지우면 경로 자체가 404 가 된다.
 *
 * 데모 계정은 지울 수 없다 (isDemoAccount → deleteAccount 가 거절). 심사자가 '탈퇴' 를
 * 누르면 시드 12편·반 순위가 통째로 사라지기 때문이다.
 */

import "server-only";

import type { ProfileRole } from "@/shared/types";

/** 시드가 만드는 계정 (supabase/seed.sql §2·§3). env 로 바꿀 수 있다 */
const DEFAULT_EMAIL: Record<ProfileRole, string> = {
  student: "demo@bookit.demo",
  teacher: "teacher2@bookit.demo",
};

/** 데모데이. 이 날이 지나면 env 를 안 지워도 문이 닫힌다 */
const DEFAULT_UNTIL = "2026-10-17";

const DEMO_DOMAIN = "@bookit.demo";

export function demoLoginEnabled(now = new Date()): boolean {
  if (process.env.DEMO_LOGIN_ENABLED?.trim() !== "true") return false;
  const until = process.env.DEMO_LOGIN_UNTIL?.trim() || DEFAULT_UNTIL;
  // 그날 자정(KST)까지 산다
  const deadline = new Date(`${until}T23:59:59+09:00`);
  return Number.isNaN(deadline.getTime()) ? false : now <= deadline;
}

export function demoEmailFor(role: ProfileRole): string {
  const fromEnv =
    role === "student"
      ? process.env.DEMO_STUDENT_EMAIL
      : process.env.DEMO_TEACHER_EMAIL;
  return fromEnv?.trim() || DEFAULT_EMAIL[role];
}

/** 시드 계정 전부 — 지우면 데모가 통째로 사라진다 */
export function isDemoAccount(email: string | null | undefined): boolean {
  return !!email && email.toLowerCase().endsWith(DEMO_DOMAIN);
}

export function parseDemoRole(value: string | null): ProfileRole | null {
  return value === "student" || value === "teacher" ? value : null;
}
