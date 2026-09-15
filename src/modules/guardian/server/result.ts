/**
 * guardian/server/result — 도메인 함수의 반환 봉투. owner: 문민재
 *
 * verification/server/result.ts 와 같은 모양이다 — 라우트는 얇게 두고 판단은
 * 서버 모듈이 한다 (CLAUDE.md §2).
 */
import "server-only";

export type GuardianResult<T> =
  | { ok: true; data: T }
  | { ok: false; code: string; message: string; status: number };

export const failure = (
  code: string,
  message: string,
  status: number,
): GuardianResult<never> => ({ ok: false, code, message, status });

export function unexpected(context: string, cause: unknown): GuardianResult<never> {
  console.error(`[guardian:${context}]`, cause);
  return failure("server_error", "잠깐 문제가 생겼어. 다시 해볼까?", 500);
}
