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
 * 랭킹 집계·동점 처리는 teacher 모듈의 v_class_ranking·withRank 를 그대로 쓴다 —
 * 교사 화면과 학생 화면의 반 순위가 서로 다른 규칙으로 갈리면 안 된다.
 * 시간이 부족하면 챌린지를 가장 먼저 잘라낸다 (CLAUDE.md §11).
 *
 * server/ranking.ts 는 BookitClient 를 인자로 받을 뿐 service-role 을 직접
 * 만들지 않아 teacher/server/dashboard.ts 와 같은 모양이다 — 컴포넌트와
 * 한 배럴로 묶어도 클라이언트 번들이 깨지지 않는다.
 */

export { ChallengeScreen } from "./components/ChallengeScreen";
export { getClassRanking, getChallenges, type RankingResult } from "./server/ranking";
