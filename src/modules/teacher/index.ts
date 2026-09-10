/**
 * teacher — owner: 김민경
 *
 * 학급 랭킹 집계, 학생별 진도 조회. 데스크톱 전용 (1024px+).
 *
 * 이 파일이 모듈의 유일한 public surface다.
 * 다른 모듈은 반드시 여기를 통해서만 import 한다 (CLAUDE.md §2).
 * 내부 구조: components/ · server/ · schema.ts
 *
 * 계획된 export (docs/spec.md §5):
 *   GET /api/teacher/class     → { class, join_code, stats }
 *   GET /api/teacher/students  → { rows[] }  name, passed_count, avg_score, streak, last_active
 *   GET /api/teacher/ranking   → { rows[] }
 *
 * rows[] 에는 독후감 본문이 절대 들어가지 않는다 (CLAUDE.md §5).
 * 조회는 reviews 테이블 직접이 아니라 v_teacher_* 뷰를 경유한다.
 * 모바일 레이아웃은 만들지 않는다 (CLAUDE.md §8).
 *
 * ⚠️ 아래 mock export 는 임시다. 실제 Route Handler 가 붙으면 mock.ts 와 함께 지운다.
 */

export { TeacherDashboard } from "./components/TeacherDashboard";
export { WEEKLY_CONTRIB, getClass, getRanking, getStudents } from "./mock";
