/**
 * `{ data }` / `{ error }` 응답 봉투 — books 모듈 내부 임시 버전.
 *
 * 원래 `@/shared/api`(김민경 소유)에 같은 시그니처의 ok/fail/unauthorized가 있어야 하는데,
 * main 브랜치 유실로 지금 존재하지 않는다 (docs/superpowers/specs/2026-09-14-books-search-recommend-design.md).
 * shared/api가 복구되면 이 파일을 지우고 import만 바꾸면 되도록 이름과 반환 타입을 맞춰둔다.
 * shared/ 는 직접 고치지 않는다 (CLAUDE.md §2).
 */
import "server-only";

import { NextResponse } from "next/server";

import type { ApiResponse } from "@/shared/types";

export function ok<T>(data: T): NextResponse<ApiResponse<T>> {
  return NextResponse.json({ data });
}

export function fail(
  code: string,
  message: string,
  status: number,
): NextResponse<ApiResponse<never>> {
  return NextResponse.json({ error: { code, message } }, { status });
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
