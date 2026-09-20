/**
 * 학년 표기. 1=초1 … 6=초6, 7=중1, 8=중2, 9=중3 (docs/spec.md §1).
 *
 * 소유: 김민경 (CLAUDE.md §3).
 *
 * 2026-09-20 타겟을 초등 저학년(초1~3)으로 좁혔다 — 시작 화면에서 고를 수 있는 학년은
 * 이 셋뿐이다. DB check 제약·gradeLevelSchema(1..9)와 gradeLabel 은 그대로 둔다:
 * 이미 만들어진 시드 반(5학년)·기존 프로필이 깨지면 안 되고, 서재 도서의 target_grade
 * 범위도 그대로 쓰기 때문이다.
 */

import type { GradeLevel } from "@/shared/types";

export const GRADES: Array<{ value: GradeLevel; label: string }> = [
  { value: 1, label: "초1" },
  { value: 2, label: "초2" },
  { value: 3, label: "초3" },
];

export const gradeLabel = (grade: GradeLevel): string =>
  grade <= 6 ? `초등학교 ${grade}학년` : `중학교 ${grade - 6}학년`;
