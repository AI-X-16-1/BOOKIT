/**
 * POST /api/checkpoints  { book_id, chapter_no } → { checkpoint_id, question }
 *
 * 소유: 강민구 (docs/spec.md §5b, docs/sprint-0918.md ③ — AI #6).
 * 얇게 유지한다 — 판단은 modules/reader/server 의 openCheckpoint 가 한다 (CLAUDE.md §2).
 *
 * 이미 만들어 둔 문항이 있으면 그것을 그대로 돌려준다. 책갈피와는 무관하다 (spec §2b).
 */
import type { NextRequest, NextResponse } from "next/server";

import { openCheckpoint } from "@/modules/reader/server";
import { createCheckpointSchema } from "@/modules/verification";
import { fail, invalidBody, ok, readJson, serverError, unauthorized } from "@/shared/api";
import { createServerSupabase } from "@/shared/supabase/server";
import type { ApiResponse, CreateCheckpointResponse } from "@/shared/types";

export async function POST(
  request: NextRequest,
): Promise<NextResponse<ApiResponse<CreateCheckpointResponse>>> {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return unauthorized();

  const parsed = createCheckpointSchema.safeParse(await readJson(request));
  if (!parsed.success) return invalidBody("어느 장인지 알 수 없어.");

  try {
    const result = await openCheckpoint(
      supabase,
      user.id,
      parsed.data.book_id,
      parsed.data.chapter_no,
    );
    if (!result.ok) return fail(result.code, result.message, result.status);
    return ok(result.data);
  } catch (cause) {
    return serverError("api/checkpoints", cause);
  }
}
