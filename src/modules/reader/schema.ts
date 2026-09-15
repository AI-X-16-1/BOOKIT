/**
 * reader — 모듈 안에서만 쓰는 타입. owner: 강민구
 *
 * API 계약(ReaderChapterResponse·DictResponse)은 src/shared/types 에 있다.
 * 서재 책 목록은 라우트로 나가지 않고 서버 컴포넌트가 화면에 바로 넘기므로 여기 둔다.
 */
import type { DictResponse } from "@/shared/types";

/** 낱말 뜻 하나 */
export interface DictSense {
  definition: string;
}

/**
 * GET /api/dict 응답. 공유 계약 DictResponse 에 senses 를 더한 것이다.
 *
 * 사전은 문맥을 보지 않으므로 뜻을 여러 개 보여주고 아이가 글에 맞는 뜻을 고른다 (#43).
 * definition 은 senses[0] 과 같다 — DictResponse 만 아는 쪽이 깨지지 않게 남긴다.
 * src/shared/types 는 김민경 소유라 여기 둔다. 공유 타입으로 올릴지는 #43 에서 정한다.
 */
export interface ReaderDictResponse extends DictResponse {
  /** 쉬운 등급의 표제어부터, 사전에 적힌 순서대로. 1~5개 */
  senses: DictSense[];
}

/** 책잇 서재 한 칸. 본문이 한 장이라도 있는 저작권 만료 도서만 들어온다. */
export interface ShelfBook {
  id: string;
  title: string;
  author: string;
  gradeMin: number | null;
  gradeMax: number | null;
  /** book_contents 의 장 수. 1장부터 빈틈 없이 이어진다고 가정한다 */
  chapterCount: number;
}
