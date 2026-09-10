/**
 * ranking — owner: 문민재
 *
 * 반 대 반 랭킹(학생 쪽 화면), 챌린지.
 *
 * 이 파일이 모듈의 유일한 public surface다.
 * 다른 모듈은 반드시 여기를 통해서만 import 한다 (CLAUDE.md §2).
 * 내부 구조: components/ · server/ · schema.ts
 *
 * 계획된 export (docs/spec.md §5):
 *   GET /api/ranking/class  → { my_class, rows[] }
 *   GET /api/challenges     → { class_goal, season }
 *
 * AI 검증을 통과한 완독만 집계한다. 개인 순위는 노출하지 않는다 — 반 단위만 (docs/plan.md §4).
 * 시간이 부족하면 챌린지를 가장 먼저 잘라낸다 (CLAUDE.md §11).
 *
 * ⚠️ 아래 mock export 는 임시다. 실제 Route Handler 가 붙으면 mock.ts 와 함께 지운다.
 */

export { ChallengeScreen } from "./components/ChallengeScreen";
export { getChallenges, getClassRanking } from "./mock";
