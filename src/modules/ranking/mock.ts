/**
 * ranking 모듈 목 데이터. ⚠️ 임시 — 실제 API 가 붙으면 지운다.
 * seed.sql 의 반별 집계와 같은 값을 쓴다.
 */
import type {
  ChallengesResponse,
  ClassRankingResponse,
} from "@/shared/types";
import { delay } from "@/modules/review";

/** GET /api/ranking/class — 개인 순위는 노출하지 않는다. 반 단위만 (docs/plan.md §4). */
export async function getClassRanking(): Promise<ClassRankingResponse> {
  await delay(250);
  const rows = [
    { class_id: "d2", label: "한빛초 5학년 2반", verified_count: 52, rank: 1 },
    { class_id: "d5", label: "한빛초 5학년 5반", verified_count: 47, rank: 2 },
    { class_id: "d3", label: "한빛초 5학년 3반", verified_count: 41, rank: 3 },
    { class_id: "d1", label: "한빛초 5학년 1반", verified_count: 38, rank: 4 },
    { class_id: "d4", label: "한빛초 5학년 4반", verified_count: 29, rank: 5 },
  ];
  return { my_class: rows[0], rows };
}

/** GET /api/challenges */
export async function getChallenges(): Promise<ChallengesResponse> {
  await delay(250);
  return {
    class_goal: {
      id: "e1",
      title: "👥 5학년 2반 함께 읽기",
      target: 200,
      value: 134,
      starts_on: "2026-08-20",
      ends_on: "2026-09-30",
    },
    season: {
      id: "e2",
      title: "🍂 가을 독서 원정대",
      target: 5,
      value: 3,
      starts_on: "2026-10-01",
      ends_on: "2026-10-31",
    },
  };
}
