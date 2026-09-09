/**
 * growth — owner: 문민재
 *
 * 연속 출석(스트릭), 책나무, 장르 도장판, 레벨/뱃지.
 *
 * 이 파일이 모듈의 유일한 public surface다.
 * 다른 모듈은 반드시 여기를 통해서만 import 한다 (CLAUDE.md §2).
 * 내부 구조: components/ · server/ · schema.ts
 *
 * 계획된 export (docs/spec.md §5):
 *   GET /api/growth  → { streak, tree_stage, leaves, stamps[] }
 *
 * 장르 도장은 완독 3권당 1개 (docs/spec.md §2).
 * 시간이 부족하면 레벨/뱃지 → 책나무·도장판 순으로 잘라낸다 (CLAUDE.md §11).
 */
export {};
