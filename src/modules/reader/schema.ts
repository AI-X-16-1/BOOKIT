/**
 * reader — 모듈 안에서만 쓰는 타입. owner: 강민구
 *
 * API 계약(ReaderChapterResponse·DictResponse)은 src/shared/types 에 있다.
 * 서재 책 목록은 라우트로 나가지 않고 서버 컴포넌트가 화면에 바로 넘기므로 여기 둔다.
 */
import { z } from "zod";

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
  /** 표지. 서재 책은 `/covers/<id>.webp` (오프라인 배치, scripts/covers-generate.mjs). 없으면 그라데이션 */
  coverUrl: string | null;
}

/**
 * POST /api/reading/progress 요청 본문 (spec §5b).
 *
 * uuid 는 모양만 본다 — z.uuid() 는 RFC 버전 비트까지 검사해서 시드의 고정 id 일부를
 * 거절한다. 여기서는 Postgres 가 22P02 로 터지지 않게 막는 게 목적이다.
 */
export const readingProgressSchema = z.object({
  book_id: z.guid(),
  chapter_no: z.number().int().min(1),
});

/**
 * POST /api/reading/quiz  { book_id, chapter_no, upto_word } → WordQuizResponse | null
 *
 * 낱말 퀴즈 (AI #8, 2026-09-19). 읽는 도중에 뜨는 미니게임 한 문제.
 * `upto_word` = 지금 펼친 쪽의 첫 낱말 번호(data-word). 그 앞까지가 "방금 읽은 대목" 이다.
 * 0 이면 앞 장의 끝을 쓴다 — 새 장 첫 쪽을 펼친 순간이 곧 앞 장을 다 읽은 순간이다
 */
export const wordQuizRequestSchema = z.object({
  book_id: z.guid(),
  chapter_no: z.number().int().min(1),
  upto_word: z.number().int().min(0),
  /** 이 책에서 이미 물어본 낱말 — 같은 낱말을 또 내지 않는다. 화면이 들고 있다 */
  avoid: z.array(z.string().min(1).max(40)).max(10).default([]),
});

/** 퀴즈 한 문제. 정답 자리를 같이 준다 — 걸린 것이 없는 놀이라 화면이 바로 맞춘다 */
export interface WordQuizResponse {
  word: string;
  sentence: string;
  choices: [string, string, string];
  answer: number;
}

