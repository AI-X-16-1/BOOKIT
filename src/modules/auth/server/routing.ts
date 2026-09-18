/**
 * 접근 상태 → 어디로 보낼지.
 *
 * 소유: 김민경 (CLAUDE.md §3).
 *
 * 순수 함수만 둔다. 요청도 DB 도 모른다 — 그래서 표만 읽으면 규칙 전체가 보인다.
 * src/middleware.ts 가 이 표를 그대로 집행한다.
 *
 * 규칙:
 *   미로그인            공개 경로 외 전부 → /login
 *   온보딩 미완         어디에 있어도     → /onboarding
 *   학생                /login, /onboarding, /, 교사 화면 → /home
 *   교사                /login, /onboarding, /, 학생 화면 → /teacher
 *
 * 교사를 학생 화면에서 막는 건 권한 문제가 아니라 화면 문제다. 교사 대시보드는
 * 데스크톱 전용이고, 학생 화면은 모바일 기준으로 만든다 (CLAUDE.md §8).
 */

import type { AccessState } from "./session";

export const AUTH_PATHS = {
  login: "/login",
  onboarding: "/onboarding",
  studentHome: "/home",
  teacherHome: "/teacher",
} as const;

/**
 * 학생 전용 화면. 하단 탭 5개(홈·독후감·도감·나·서재) + 탭에서 빠진 /challenge.
 * 학생 라우트를 새로 만들면 여기에도 넣어야 교사가 못 들어간다 — 빠지면 리다이렉트 없이
 * 열린다 (#145 에서 /collection 이 그랬다. RLS 가 데이터는 막았지만 빈 화면이 보였다).
 */
const STUDENT_PREFIXES = [
  "/home",
  "/write",
  "/collection",
  "/challenge",
  "/me",
  "/library",
] as const;

/** 교사 전용 화면 */
const TEACHER_PREFIXES = ["/teacher"] as const;

/**
 * 인증을 요구하지 않는 경로.
 *
 * /auth  — 구글 OAuth 콜백. 여기서 쿠키를 심으므로 미들웨어가 끼어들면 안 된다
 * /api   — Route Handler 가 스스로 인증한다. 보호자 라우트는 애초에 인증이 없다
 * /guardian — 토큰만으로 보는 읽기 전용 화면 (docs/spec.md §3)
 * /privacy, /terms — 개인정보처리방침·이용약관. 게시 의무라 누구나 봐야 한다 (#93)
 */
const PUBLIC_PREFIXES = [
  AUTH_PATHS.login,
  "/auth",
  "/api",
  "/guardian",
  "/privacy",
  "/terms",
] as const;

/** 로그인 상태와 무관하게 절대 리다이렉트하지 않는 경로 */
const UNTOUCHED_PREFIXES = ["/auth", "/api", "/guardian", "/privacy", "/terms"] as const;

function startsWithPath(pathname: string, prefix: string): boolean {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

export function isPublicPath(pathname: string): boolean {
  return PUBLIC_PREFIXES.some((prefix) => startsWithPath(pathname, prefix));
}

/**
 * 보낼 곳이 없으면 null — 그대로 통과시킨다.
 * 이미 목적지에 있을 때 null 을 돌려주는 게 중요하다. 아니면 리다이렉트가 무한히 돈다.
 */
export function redirectTargetFor(
  access: AccessState,
  pathname: string,
): string | null {
  // 콜백·API·보호자 링크·법적 고지는 상태와 무관하게 건드리지 않는다
  if (UNTOUCHED_PREFIXES.some((prefix) => startsWithPath(pathname, prefix))) {
    return null;
  }

  if (access.kind === "anonymous") {
    return isPublicPath(pathname) ? null : AUTH_PATHS.login;
  }

  if (access.kind === "onboarding") {
    return pathname === AUTH_PATHS.onboarding ? null : AUTH_PATHS.onboarding;
  }

  const home =
    access.kind === "teacher" ? AUTH_PATHS.teacherHome : AUTH_PATHS.studentHome;

  // 온보딩을 끝낸 사람이 로그인·온보딩 화면이나 루트에 있으면 자기 홈으로
  if (
    pathname === "/" ||
    pathname === AUTH_PATHS.login ||
    pathname === AUTH_PATHS.onboarding
  ) {
    return home;
  }

  const wrongSide =
    access.kind === "teacher"
      ? STUDENT_PREFIXES.some((prefix) => startsWithPath(pathname, prefix))
      : TEACHER_PREFIXES.some((prefix) => startsWithPath(pathname, prefix));

  return wrongSide ? home : null;
}
