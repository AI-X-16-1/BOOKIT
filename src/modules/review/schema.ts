/**
 * review 요청 본문 검증과 화면·서버가 같이 쓰는 계약 — docs/spec.md §5.
 *
 * 소유: 박재경 (CLAUDE.md §3).
 * server-only 가 아니다. 에디터와 라우트가 같은 상한을 봐야 해서 여기 둔다.
 */

import { z } from "zod";

import type { Book, Review, ReviewGapView } from "@/shared/types";

/**
 * 독후감 본문 상한. 초등·중학생 독후감으로는 넉넉하고,
 * 빈틈 분석 프롬프트에 과도한 길이가 들어가는 걸 막는 용도다.
 */
export const MAX_REVIEW_CHARS = 5000;

/** 이보다 짧으면 빈틈을 찾을 거리가 없다. 에디터의 제출 버튼도 같은 값으로 막는다 */
export const MIN_SUBMIT_CHARS = 10;

/**
 * uuid 모양만 본다. z.uuid() 는 RFC 버전 비트까지 검사해서
 * 시드의 고정 id 일부를 거절한다 — 여기서는 Postgres 가 22P02 로 터지지 않게 막는 게 목적이다.
 */
export const idSchema = z.guid();

/** POST /api/reviews */
export const createReviewSchema = z.object({
  book_id: idSchema,
});

/** PATCH /api/reviews/:id — 자동 저장. 빈 문자열도 받는다 (다 지운 상태도 초고다) */
export const updateReviewSchema = z.object({
  body: z.string().max(MAX_REVIEW_CHARS),
});

/**
 * /write 화면이 서버에서 받아 오는 것.
 *
 * review 가 null 이면 이 책으로 쓴 독후감이 아직 없다는 뜻이다. 화면은 학생이
 * 처음 저장할 때 POST /api/reviews 로 초고를 만든다 — 들어오기만 해도 빈 초고가
 * 쌓이지 않게 하려는 것이다.
 * gaps 가 비어 있지 않으면 이미 제출해서 빈틈 분석까지 끝난 독후감이다.
 */
export interface WriteSession {
  book: Pick<Book, "id" | "title" | "author" | "cover_url">;
  review: Review | null;
  gaps: ReviewGapView[];
  streakDays: number;
}
