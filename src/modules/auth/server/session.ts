/**
 * 로그인 상태 → 접근 상태 해석.
 *
 * 소유: 김민경 (CLAUDE.md §3).
 *
 * "로그인했는가"만으로는 어디로 보낼지 정할 수 없다. 온보딩을 끝냈는지,
 * 학생인지 교사인지까지 봐야 한다. 그 판단을 한 곳에 모은다.
 *
 * 온보딩 완료 기준 (docs/spec.md §2):
 *   학생 — profiles.grade_level 이 있고 class_members 에 행이 있다
 *   교사 — 자기가 소유한 classes 행이 있다 (= join_code 를 발급받았다)
 */

import type { User } from "@supabase/supabase-js";

import type { BookitClient } from "@/shared/supabase";
import type { ProfileRole } from "@/shared/types";

export type AccessState =
  | { kind: "anonymous" }
  /** 로그인은 했지만 아직 반에 들어오지 않았다. role 은 아직 안 고른 상태면 null */
  | { kind: "onboarding"; role: ProfileRole | null }
  | { kind: "student" }
  | { kind: "teacher" };

export async function resolveAccess(
  supabase: BookitClient,
  user: User | null,
): Promise<AccessState> {
  if (!user) return { kind: "anonymous" };

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, grade_level")
    .eq("id", user.id)
    .maybeSingle();

  // 구글 로그인 직후. profiles 행은 온보딩 라우트가 만든다
  if (!profile) return { kind: "onboarding", role: null };

  if (profile.role === "teacher") {
    const owned = await supabase
      .from("classes")
      .select("id", { count: "exact", head: true })
      .eq("teacher_id", user.id);

    return (owned.count ?? 0) > 0
      ? { kind: "teacher" }
      : { kind: "onboarding", role: "teacher" };
  }

  if (profile.grade_level === null) {
    return { kind: "onboarding", role: "student" };
  }

  const joined = await supabase
    .from("class_members")
    .select("class_id", { count: "exact", head: true })
    .eq("student_id", user.id);

  return (joined.count ?? 0) > 0
    ? { kind: "student" }
    : { kind: "onboarding", role: "student" };
}
