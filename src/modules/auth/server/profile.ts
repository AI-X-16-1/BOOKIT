/**
 * 내 정보 조회 — docs/spec.md §5 GET /api/profile.
 *
 * 소유: 김민경 (CLAUDE.md §3).
 *
 * '나' 화면 머리글에 로그인한 사람의 이름·학반을 띄우기 위한 조회다 (#71).
 * 전부 본인 권한으로 읽는다 — classes 는 RLS 가 학생에게는 들어간 반,
 * 교사에게는 자기 반만 보여주므로 role 로 나눠 조회할 필요가 없다 (0001).
 */

import type { BookitClient } from "@/shared/supabase";
import type { MeResponse } from "@/shared/types";

import type { OnboardingResult } from "./onboarding";

export async function getMyProfile(
  supabase: BookitClient,
  userId: string,
): Promise<OnboardingResult<MeResponse>> {
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("display_name, role, grade_level, explorer_rank")
    .eq("id", userId)
    .maybeSingle();

  if (profileError) {
    console.error("[auth] 프로필 조회 실패", profileError);
    return {
      ok: false,
      code: "server_error",
      message: "잠깐 문제가 생겼어. 다시 해볼까?",
      status: 500,
    };
  }
  // 구글 로그인 직후, 온보딩 전. profiles 행은 온보딩 라우트가 만든다
  if (!profile) {
    return {
      ok: false,
      code: "not_onboarded",
      message: "먼저 반에 들어가자.",
      status: 404,
    };
  }

  // 학생은 반이 하나뿐이고, 교사가 여럿이면 먼저 만든 반을 쓴다
  const { data: klass, error: classError } = await supabase
    .from("classes")
    .select("grade_level, class_no")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (classError) {
    console.error("[auth] 학급 조회 실패", classError);
    return {
      ok: false,
      code: "server_error",
      message: "잠깐 문제가 생겼어. 다시 해볼까?",
      status: 500,
    };
  }

  return {
    ok: true,
    data: {
      display_name: profile.display_name,
      role: profile.role,
      grade_level: profile.grade_level,
      explorer_rank: profile.explorer_rank,
      class_label: klass ? `${klass.grade_level}학년 ${klass.class_no}반` : null,
    },
  };
}
