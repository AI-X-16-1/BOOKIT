/**
 * Route Handler 응답 봉투 — docs/spec.md §5.
 *
 * 소유: 김민경 (CLAUDE.md §2). 다섯 모듈의 라우트가 전부 이걸 쓴다.
 *
 * 모든 응답은 { data } 아니면 { error: { code, message } } 다. 둘을 섞지 않는다.
 * message 는 화면에 그대로 띄울 수 있는 한국어 반말이어야 한다 (CLAUDE.md §9) —
 * 스택 트레이스나 DB 에러 원문을 그대로 흘리지 않는다.
 */

import { NextResponse } from "next/server";

import type { ApiResponse } from "@/shared/types";

export function ok<T>(data: T, status = 200): NextResponse<ApiResponse<T>> {
  return NextResponse.json({ data }, { status });
}

export function fail(
  code: string,
  message: string,
  status = 400,
): NextResponse<ApiResponse<never>> {
  return NextResponse.json({ error: { code, message } }, { status });
}

/** 로그인이 풀린 상태. 화면은 이걸 받으면 /login 으로 보낸다 */
export function unauthorized(): NextResponse<ApiResponse<never>> {
  return fail("unauthorized", "다시 로그인해줘.", 401);
}

/** 본문이 계약과 다를 때. 어느 필드가 틀렸는지는 클라이언트에 알리지 않는다 */
export function invalidBody(
  message = "입력을 다시 확인해줘.",
): NextResponse<ApiResponse<never>> {
  return fail("invalid_body", message, 400);
}

/**
 * 예상 못 한 실패. 원인은 서버 로그에만 남긴다.
 * 어린이 화면에 뜨는 문장이라 "500" 같은 말을 쓰지 않는다.
 */
export function serverError(
  context: string,
  cause: unknown,
): NextResponse<ApiResponse<never>> {
  console.error(`[${context}]`, cause);
  return fail("server_error", "잠깐 문제가 생겼어. 다시 해볼까?", 500);
}

/** 요청 본문 파싱. JSON 이 아니면 null 을 돌려준다 */
export async function readJson(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    return null;
  }
}
