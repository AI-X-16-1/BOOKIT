/**
 * teacher 모듈 목 데이터. ⚠️ 임시 — 실제 Route Handler 가 붙으면 지운다.
 *
 * 여기 실린 어떤 타입에도 독후감 본문(reviews.body)이나
 * 답변 원문(verifications.answer)에 해당하는 필드가 없다. 의도적이다 (CLAUDE.md §5).
 * 실제 조회도 reviews 테이블 직접이 아니라 v_teacher_* 뷰를 경유한다.
 */
import type {
  TeacherClassResponse,
  TeacherRankingResponse,
  TeacherStudentsResponse,
} from "@/shared/types";
import { delay } from "@/modules/review";

/** GET /api/teacher/class */
export async function getClass(): Promise<TeacherClassResponse> {
  await delay(250);
  return {
    class: {
      id: "d2",
      teacher_id: "c2",
      school_name: "한빛초",
      grade_level: 5,
      class_no: 2,
      join_code: "HB5CLB",
      created_at: "2026-07-10T00:00:00Z",
    },
    join_code: "HB5CLB",
    stats: { student_count: 24, completed_count: 148, avg_score: 91 },
  };
}

/** GET /api/teacher/ranking — 반 단위. 개인 순위는 만들지 않는다. */
export async function getRanking(): Promise<TeacherRankingResponse> {
  await delay(250);
  return {
    rows: [
      { class_id: "d3", label: "5학년 3반", verified_count: 8240, rank: 1 },
      { class_id: "d2", label: "5학년 2반", verified_count: 7410, rank: 2 },
      { class_id: "d1", label: "5학년 1반", verified_count: 6890, rank: 3 },
      { class_id: "d6", label: "6학년 1반", verified_count: 5860, rank: 4 },
      { class_id: "d4", label: "4학년 2반", verified_count: 5270, rank: 5 },
    ],
  };
}

/** GET /api/teacher/students — 이름·통과수·평균점수·스트릭·마지막 활동만. */
export async function getStudents(): Promise<TeacherStudentsResponse> {
  await delay(250);
  return {
    rows: [
      { student_id: "s1", name: "민서", passed_count: 12, avg_score: 100, streak: 7, last_active: "2026-09-09T02:00:00Z" },
      { student_id: "s2", name: "준호", passed_count: 10, avg_score: 83, streak: 4, last_active: "2026-09-08T08:00:00Z" },
      { student_id: "s3", name: "서윤", passed_count: 9, avg_score: 83, streak: 3, last_active: "2026-09-08T05:00:00Z" },
      { student_id: "s4", name: "지우", passed_count: 7, avg_score: 67, streak: 0, last_active: "2026-09-05T07:00:00Z" },
      { student_id: "s5", name: "하윤", passed_count: 6, avg_score: 83, streak: 2, last_active: "2026-09-07T06:00:00Z" },
      { student_id: "s6", name: "도윤", passed_count: 4, avg_score: 67, streak: 0, last_active: "2026-09-02T04:00:00Z" },
    ],
  };
}

/** 이번 주 기여 상위 — 목업 5 L98-101. 반 합계에 얼마나 보탰는지만 보여준다. */
export const WEEKLY_CONTRIB = [
  { name: "민서", points: 560 },
  { name: "준호", points: 490 },
  { name: "서윤", points: 450 },
];
