/**
 * 탈퇴 — auth.users 행을 지우면 profiles 가 cascade 로 따라 지워지고(0001),
 * 그 아래 class_members·reviews·verifications·points_ledger 등도 전부 cascade 다.
 * 교사면 classes 도 지워져 학생들은 반 없는 상태(온보딩)로 돌아간다.
 *
 * 소유: 김민경 (CLAUDE.md §3).
 *
 * auth.users 삭제는 service role 만 할 수 있다. 소유권은 라우트가 세션에서 꺼낸
 * user.id 를 그대로 넘기는 것으로 보장된다 — 입력에서 온 id 가 아니다.
 */

import { createAdminClient } from "@/shared/supabase/admin";

import { isDemoAccount } from "./demo";
import type { OnboardingResult } from "./onboarding";

export async function deleteAccount(
  userId: string,
  email: string | null | undefined,
): Promise<OnboardingResult<{ deleted: true }>> {
  // 시드 계정은 지우지 않는다 — 심사자가 '탈퇴' 를 누르면 데모가 통째로 사라진다 (server/demo.ts)
  if (isDemoAccount(email)) {
    return {
      ok: false,
      code: "demo_account",
      message: "시연 계정은 탈퇴할 수 없어.",
      status: 403,
    };
  }

  const admin = createAdminClient();
  const { error } = await admin.auth.admin.deleteUser(userId);

  if (error) {
    console.error("[auth] 탈퇴 실패", error);
    return {
      ok: false,
      code: "server_error",
      message: "잠깐 문제가 생겼어. 다시 해볼까?",
      status: 500,
    };
  }

  return { ok: true, data: { deleted: true } };
}
