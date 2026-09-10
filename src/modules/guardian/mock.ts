/**
 * guardian 모듈 목 데이터. ⚠️ 임시 — 실제 Route Handler 가 붙으면 지운다.
 *
 * 보호자가 보는 것: 완독 여부, 책갈피, 이해도 점수, 책 목록.
 * 독후감 본문은 절대 포함되지 않는다 (CLAUDE.md §5).
 * 아래 타입에도 body 에 해당하는 필드가 아예 없다.
 *
 * 실제 구현에서는 토큰 조회가 service role 을 쓰는 Route Handler 를 경유한다.
 * 브라우저에서 직접 쿼리하지 않는다 (docs/spec.md §3).
 */
import type { GuardianSummaryResponse } from "@/shared/types";
import { delay } from "@/modules/review";

/** 데모용 토큰. 실제로는 32자 이상 랜덤이다 (0005 마이그레이션의 check 제약). */
export const DEMO_TOKEN = "demo0000000000000000000000000000";

/** GET /api/guardian/:token — 인증 없음. */
export async function getGuardianSummary(
  token: string,
): Promise<GuardianSummaryResponse | null> {
  await delay(400);
  if (token !== DEMO_TOKEN) return null;
  return {
    summary: {
      display_name: "민서",
      completed_count: 3,
      points: 1240,
      avg_score: 94,
    },
    books: [
      { title: "아몬드", author: "손원평", cover_url: null, passed: true },
      { title: "완득이", author: "김려령", cover_url: null, passed: true },
      { title: "마당을 나온 암탉", author: "황선미", cover_url: null, passed: true },
      { title: "어린 왕자", author: "생텍쥐페리", cover_url: null, passed: false },
    ],
  };
}
