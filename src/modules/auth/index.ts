/**
 * auth — owner: 김민경
 *
 * Google OAuth, profiles, 역할 분기, 온보딩, 학급 코드, RLS 정책, PWA, 배포.
 *
 * 이 파일이 모듈의 유일한 public surface다.
 * 다른 모듈은 반드시 여기를 통해서만 import 한다 (CLAUDE.md §2).
 * 내부 구조: components/ · server/ · schema.ts
 *
 * 라우트 (docs/spec.md §5):
 *   GET   /auth/callback           구글 OAuth 콜백. 세션 쿠키를 심고 "/" 로 보낸다
 *   POST  /api/onboarding/student  { grade_level, join_code }             → { class }
 *   POST  /api/onboarding/teacher  { school_name, grade_level, class_no } → { class, join_code }
 *   PATCH /api/profile             { grade_level }                        → { profile }
 *
 * 학교/학급 자유 입력은 허용하지 않는다 — 6자리 join_code로만 가입 (CLAUDE.md §4).
 * Supabase 클라이언트 생성도 이 오너 소관 (src/shared/supabase/).
 */

export { LoginScreen } from "./components/LoginScreen";
export { OnboardingScreen } from "./components/OnboardingScreen";
export { SignOutButton } from "./components/SignOutButton";
export { DeleteAccountButton } from "./components/DeleteAccountButton";

export { GRADES, gradeLabel } from "./grades";

export {
  gradeLevelSchema,
  joinCodeSchema,
  studentOnboardingSchema,
  teacherOnboardingSchema,
  updateProfileSchema,
} from "./schema";

export { resolveAccess, type AccessState } from "./server/session";

export { AUTH_PATHS, isPublicPath, redirectTargetFor } from "./server/routing";

export {
  joinClassByCode,
  createClassForTeacher,
  updateGradeLevel,
  type OnboardingResult,
} from "./server/onboarding";

export { deleteAccount } from "./server/account";
