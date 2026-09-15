/**
 * growth — owner: 문민재
 *
 * 연속 출석(스트릭), 책나무, 장르 도장판.
 *
 * 이 파일이 모듈의 유일한 public surface다.
 * 다른 모듈은 반드시 여기를 통해서만 import 한다 (CLAUDE.md §2).
 * 내부 구조: components/ · server/ · schema.ts
 *
 * 계획된 export (docs/spec.md §5):
 *   GET /api/growth  → { streak, tree_stage, leaves, stamps[] }
 *
 * 장르 도장은 완독 3권당 1개 (docs/spec.md §2).
 * server/growth.ts 는 BookitClient 를 인자로 받을 뿐 자체적으로 service-role 을
 * 만들지 않는다 — teacher/server/dashboard.ts 와 같은 모양이라 한 배럴로 묶어도
 * 클라이언트 번들이 깨지지 않는다 (server-only 를 강제로 import 하는 rewards/points.ts 와 다르다).
 *
 * 레벨/뱃지·독서성향 리포트는 docs/spec.md 스키마에 없다 — GrowthSection 안에 정적
 * 데모 콘텐츠로만 남아 있고, 시간이 부족하면 가장 먼저 잘라낸다 (CLAUDE.md §11).
 */

export { GrowthSection } from "./components/GrowthSection";
export { getGrowth, type GrowthResult } from "./server/growth";
