/**
 * auth 모듈 목 데이터. ⚠️ 임시 — 실제 Supabase Auth 가 붙으면 지운다.
 */
import type {
  GradeLevel,
  StudentOnboardingResponse,
  TeacherOnboardingResponse,
} from "@/shared/types";
import { delay } from "@/modules/review";

/** 1=초1 … 6=초6, 7=중1, 8=중2, 9=중3 (docs/spec.md §1). */
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

export const gradeLabel = (g: GradeLevel) =>
  g <= 6 ? `초등학교 ${g}학년` : `중학교 ${g - 6}학년`;

/** 데모용 유효 코드. 실제로는 classes.join_code 를 조회한다. */
const VALID_CODE = "HBCLSB";

/**
 * POST /api/onboarding/student
 * 학교·반 자유 입력은 받지 않는다 — 6자리 코드로만 들어온다 (CLAUDE.md §4).
 */
export async function joinAsStudent(
  grade: GradeLevel,
  joinCode: string,
): Promise<StudentOnboardingResponse> {
  await delay(700);
  if (joinCode.toUpperCase() !== VALID_CODE) {
    throw new Error("INVALID_JOIN_CODE");
  }
  return {
    class: {
      id: "0000d001-0000-4000-8000-000000000002",
      teacher_id: "0000c001-0000-4000-8000-000000000002",
      school_name: "한빛초",
      grade_level: grade,
      class_no: 2,
      join_code: VALID_CODE,
      created_at: new Date().toISOString(),
    },
  };
}

/** POST /api/onboarding/teacher — 반을 만들면 6자리 코드가 발급된다. */
export async function createClass(
  schoolName: string,
  gradeLevel: number,
  classNo: number,
): Promise<TeacherOnboardingResponse> {
  await delay(700);
  // 헷갈리는 0/O/1/I 를 뺀 알파벳 (0001 마이그레이션의 generate_join_code 와 동일)
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const code = Array.from(
    { length: 6 },
    () => alphabet[Math.floor(Math.random() * alphabet.length)],
  ).join("");
  return {
    class: {
      id: crypto.randomUUID(),
      teacher_id: crypto.randomUUID(),
      school_name: schoolName,
      grade_level: gradeLevel,
      class_no: classNo,
      join_code: code,
      created_at: new Date().toISOString(),
    },
    join_code: code,
  };
}

/** 데모에서 코드를 몰라도 진행할 수 있게 화면에 보여준다. */
export const DEMO_JOIN_CODE = VALID_CODE;
