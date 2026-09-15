/**
 * 브라우저에서 우리 Route Handler 를 부를 때 쓰는 얇은 래퍼.
 *
 * 소유: 김민경 (CLAUDE.md §2).
 *
 * 서버가 { data } 아니면 { error: { code, message } } 로만 답하니(docs/spec.md §5)
 * 그 봉투를 여기서 한 번만 벗긴다. message 는 이미 아이에게 보여줄 수 있는 문장이라
 * 화면은 그대로 띄우면 된다 (CLAUDE.md §9).
 *
 * next/server 를 import 하는 ./respond 와 같은 배럴에 두지 않는다 —
 * 클라이언트 번들에 섞이면 빌드가 깨진다.
 */

import type { ApiResponse } from "@/shared/types";

export class ApiClientError extends Error {
  constructor(
    message: string,
    readonly code: string,
  ) {
    super(message);
    this.name = "ApiClientError";
  }
}

async function request<T>(
  path: string,
  method: "GET" | "POST" | "PATCH" | "DELETE",
  body?: unknown,
): Promise<T> {
  let payload: ApiResponse<T>;

  try {
    const response = await fetch(path, {
      method,
      headers: body === undefined ? undefined : { "content-type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    payload = (await response.json()) as ApiResponse<T>;
  } catch (cause) {
    // 네트워크가 끊겼거나 JSON 이 아닌 응답
    console.error(`[api] ${method} ${path}`, cause);
    throw new ApiClientError("연결이 끊겼어. 다시 해볼까?", "network_error");
  }

  if ("error" in payload) {
    throw new ApiClientError(payload.error.message, payload.error.code);
  }
  return payload.data;
}

export const apiGet = <T>(path: string): Promise<T> =>
  request<T>(path, "GET");

export const apiPost = <T>(path: string, body: unknown): Promise<T> =>
  request<T>(path, "POST", body);

export const apiPatch = <T>(path: string, body: unknown): Promise<T> =>
  request<T>(path, "PATCH", body);

export const apiDelete = <T>(path: string): Promise<T> =>
  request<T>(path, "DELETE");
