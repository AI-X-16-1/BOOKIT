/**
 * reader 의 브라우저 쪽 호출. owner: 강민구
 *
 * 서버가 { data } 아니면 { error: { code, message } } 로만 답한다 (docs/spec.md §5).
 * 봉투는 @/shared/api/client 가 벗긴다. message 는 이미 아이에게 보여줄 수 있는 문장이다.
 */
import { apiGet, apiPost } from "@/shared/api/client";
import type { ReaderChapterResponse, ReadingProgressResponse } from "@/shared/types";
import type { ReaderDictResponse } from "./schema";

/** 한 장의 제목과 본문. 없는 장이거나 읽을 수 없는 책이면 ApiClientError(code: "not_found"). */
export function fetchChapter(
  bookId: string,
  chapterNo: number,
): Promise<ReaderChapterResponse> {
  return apiGet<ReaderChapterResponse>(
    `/api/reader/${encodeURIComponent(bookId)}?chapter=${chapterNo}`,
  );
}

/** 낱말 하나의 뜻들. 사전에 없으면 ApiClientError(code: "not_found") 가 난다. */
export function fetchDictEntry(word: string): Promise<ReaderDictResponse> {
  return apiGet<ReaderDictResponse>(`/api/dict?word=${encodeURIComponent(word)}`);
}

/**
 * 그 장을 다 읽었다고 알린다 (spec §5b, sprint-0918 ①).
 *
 * 표지 퍼즐 조각과 캐릭터 알·부화가 이 호출에서 나온다. 읽는 흐름을 막지 않는 부가
 * 기록이라 화면은 실패를 무시한다 — 다음 장에서 다시 보내고, 같은 장은 중복 무시된다.
 */
export function recordChapterRead(
  bookId: string,
  chapterNo: number,
): Promise<ReadingProgressResponse> {
  return apiPost<ReadingProgressResponse>("/api/reading/progress", {
    book_id: bookId,
    chapter_no: chapterNo,
  });
}
