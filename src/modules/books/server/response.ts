/**
 * `{ data }` / `{ error }` 응답 봉투 — books 모듈 내부 임시 버전.
 *
 * 원래 `@/shared/api`(김민경 소유)에 같은 시그니처의 ok/fail/unauthorized가 있어야 하는데,
 * main 브랜치 유실로 지금 존재하지 않는다 (docs/superpowers/specs/2026-09-14-books-search-recommend-design.md).
 * shared/api가 복구되면 이 파일을 지우고 import만 바꾸면 되도록 이름과 반환 타입을 맞춰둔다.
 * shared/ 는 직접 고치지 않는다 (CLAUDE.md §2).
 *
 * NOTE: `import "server-only"` 제거 — Node 테스트 환경에서 불가능.
 * Response.json() 사용하되, 타입 표기는 NextResponse<...>로 유지.
 * 구조적으로 호환되므로 실제 Next.js 런타임에서도 정상 작동.
 */
import type { NextResponse } from "next/server";

import type { ApiResponse } from "@/shared/types";

export function ok<T>(data: T): NextResponse<ApiResponse<T>> {
  return Response.json({ data }) as NextResponse<ApiResponse<T>>;
}

export function fail(
  code: string,
  message: string,
  status: number,
): NextResponse<ApiResponse<never>> {
  return Response.json({ error: { code, message } }, { status }) as NextResponse<ApiResponse<never>>;
}

export function unauthorized(): NextResponse<ApiResponse<never>> {
  return fail("unauthorized", "로그인이 필요해.", 401);
}

export function badRequest(
  code: string,
  message: string,
): NextResponse<ApiResponse<never>> {
  return fail(code, message, 400);
}
