/**
 * guardian — owner: 문민재
 *
 * 보호자용 읽기 전용 공유 링크.
 *
 * 이 파일이 모듈의 유일한 public surface다.
 * 다른 모듈은 반드시 여기를 통해서만 import 한다 (CLAUDE.md §2).
 * 내부 구조: components/ · server/ · schema.ts
 *
 * 계획된 export (docs/spec.md §5):
 *   POST /api/guardian/link    → { url }
 *   GET  /api/guardian/:token  → { summary, books[] }   인증 없음
 *
 * 토큰 조회는 service role 을 쓰는 Route Handler 를 반드시 경유한다.
 * 브라우저에서 직접 쿼리하지 않는다 (docs/spec.md §3).
 * 보호자가 보는 것: 완독 여부, 책갈피, 이해도 점수, 책 목록.
 * 독후감 본문은 절대 노출하지 않는다 (CLAUDE.md §5).
 */
export {};
