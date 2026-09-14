/**
 * guardian/server/link — 보호자 공유 링크 발급. owner: 문민재
 *
 * docs/spec.md §5: POST /api/guardian/link → { url }
 *
 * guardian_links 는 학생 본인이 자기 행을 직접 insert 할 수 있다
 * (guardian_links_insert_own, 0005) — service role 이 필요 없다.
 * service role 은 토큰 없이 조회하는 GET /api/guardian/:token 쪽에서만 쓴다.
 *
 * 학생당 활성 링크는 하나다 (guardian_links_one_active_per_student, 0005).
 * 이미 있으면 새로 만들지 않고 그 링크를 그대로 돌려준다 — 다시 눌러도 항상
 * 같은 주소가 나와야 보호자가 즐겨찾기해 둔 링크가 안 깨진다.
 */
import { randomBytes } from "node:crypto";

import type { BookitClient } from "@/shared/supabase";
import { siteUrl } from "@/shared/supabase/env";
import type { GuardianLinkResponse } from "@/shared/types";

import { type GuardianResult, unexpected } from "./result";

const buildUrl = (token: string) => new URL(`/guardian/${token}`, siteUrl()).toString();

/** 32자 이상 랜덤 (0005 의 check 제약). 48자 hex — URL 경로에 안전한 문자만 쓴다 */
const generateToken = () => randomBytes(24).toString("hex");

async function activeLink(
  supabase: BookitClient,
  userId: string,
): Promise<GuardianResult<string | null>> {
  const { data, error } = await supabase
    .from("guardian_links")
    .select("token")
    .eq("student_id", userId)
    .is("revoked_at", null)
    .maybeSingle();

  if (error) return unexpected("link:select", error);
  return { ok: true, data: data?.token ?? null };
}

/** POST /api/guardian/link */
export async function createGuardianLink(
  supabase: BookitClient,
  userId: string,
): Promise<GuardianResult<GuardianLinkResponse>> {
  const existing = await activeLink(supabase, userId);
  if (!existing.ok) return existing;
  if (existing.data) return { ok: true, data: { url: buildUrl(existing.data) } };

  const token = generateToken();
  const { error } = await supabase
    .from("guardian_links")
    .insert({ token, student_id: userId });

  if (error) {
    // 버튼 두 번 누르기로 동시에 만들어졌을 때. 방금 다른 요청이 만든 링크를 그대로 쓴다.
    if (error.code === "23505") {
      const raced = await activeLink(supabase, userId);
      if (!raced.ok) return raced;
      if (raced.data) return { ok: true, data: { url: buildUrl(raced.data) } };
    }
    return unexpected("link:insert", error);
  }

  return { ok: true, data: { url: buildUrl(token) } };
}
