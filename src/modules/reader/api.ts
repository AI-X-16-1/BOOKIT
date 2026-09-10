/**
 * reader 의 브라우저 쪽 호출. owner: 강민구
 *
 * @/shared/api/client 에는 apiPost·apiPatch 만 있고 GET 이 없다 (김민경 소유 파일).
 * GET 라우트는 reader 말고도 books·rewards·growth·ranking·teacher 가 다 쓰므로
 * apiGet 은 shared 로 올라가는 게 맞다. 올라가면 이 파일은 지운다.
 *
 * 서버가 { data } 아니면 { error: { code, message } } 로만 답한다 (docs/spec.md §5).
 * message 는 이미 아이에게 보여줄 수 있는 문장이라 화면은 그대로 띄우면 된다.
 */
import { ApiClientError } from "@/shared/api/client";
import type { ApiResponse, DictResponse } from "@/shared/types";

async function getJson<T>(path: string): Promise<T> {
  let payload: ApiResponse<T>;

  try {
    const response = await fetch(path);
    payload = (await response.json()) as ApiResponse<T>;
  } catch (cause) {
    console.error(`[api] GET ${path}`, cause);
    throw new ApiClientError("연결이 끊겼어. 다시 해볼까?", "network_error");
  }

  if ("error" in payload) {
    throw new ApiClientError(payload.error.message, payload.error.code);
  }
  return payload.data;
}

/** 낱말 하나의 뜻. 사전에 없으면 ApiClientError(code: "not_found") 가 난다. */
export function fetchDictEntry(word: string): Promise<DictResponse> {
  return getJson<DictResponse>(`/api/dict?word=${encodeURIComponent(word)}`);
}
