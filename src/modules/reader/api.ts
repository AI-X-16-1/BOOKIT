/**
 * reader 의 브라우저 쪽 호출. owner: 강민구
 *
 * 서버가 { data } 아니면 { error: { code, message } } 로만 답한다 (docs/spec.md §5).
 * 봉투는 @/shared/api/client 가 벗긴다. message 는 이미 아이에게 보여줄 수 있는 문장이다.
 */
import { apiGet } from "@/shared/api/client";
import type { DictResponse, ReaderChapterResponse } from "@/shared/types";

/** 한 장의 제목과 본문. 없는 장이거나 읽을 수 없는 책이면 ApiClientError(code: "not_found"). */
export function fetchChapter(
  bookId: string,
  chapterNo: number,
): Promise<ReaderChapterResponse> {
  return apiGet<ReaderChapterResponse>(
    `/api/reader/${encodeURIComponent(bookId)}?chapter=${chapterNo}`,
  );
}

/** 낱말 하나의 뜻. 사전에 없으면 ApiClientError(code: "not_found") 가 난다. */
export function fetchDictEntry(word: string): Promise<DictResponse> {
  return apiGet<DictResponse>(`/api/dict?word=${encodeURIComponent(word)}`);
}
