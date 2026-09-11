/**
 * 학년 표기. 1=초1 … 6=초6, 7=중1, 8=중2, 9=중3 (docs/spec.md §1).
 *
 * 소유: 김민경 (CLAUDE.md §3).
 */

import type { GradeLevel } from "@/shared/types";

export const GRADES: Array<{ value: GradeLevel; label: string }> = [
  { value: 1, label: "초1" },
  { value: 2, label: "초2" },
  { value: 3, label: "초3" },
  { value: 4, label: "초4" },
  { value: 5, label: "초5" },
  { value: 6, label: "초6" },
  { value: 7, label: "중1" },
  { value: 8, label: "중2" },
  { value: 9, label: "중3" },
];

export const gradeLabel = (grade: GradeLevel): string =>
  grade <= 6 ? `초등학교 ${grade}학년` : `중학교 ${grade - 6}학년`;
