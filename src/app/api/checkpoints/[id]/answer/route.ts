/**
 * POST /api/checkpoints/:id/answer  { answer } → { passed, feedback, character_stage }
 *
 * 소유: 강민구 (docs/spec.md §5b, docs/sprint-0918.md ③ — AI #6).
 *
 * 검증(POST /api/verifications/:id/answer)과 다른 점: 제한 시간이 없고, 책갈피를 주지
 * 않고, 통과하면 캐릭터가 부화할 뿐이다 (spec §2b). 채점 파이프라인은 건드리지 않는다.
 */
import type { NextRequest, NextResponse } from "next/server";

import { answerCheckpoint } from "@/modules/reader/server";
import { checkpointAnswerSchema } from "@/modules/verification";
import { fail, invalidBody, ok, readJson, serverError, unauthorized } from "@/shared/api";
import { createServerSupabase } from "@/shared/supabase/server";
import type { ApiResponse, AnswerCheckpointResponse } from "@/shared/types";

export async function POST(
  request: NextRequest,
  context: RouteContext<"/api/checkpoints/[id]/answer">,
): Promise<NextResponse<ApiResponse<AnswerCheckpointResponse>>> {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return unauthorized();

  const parsed = checkpointAnswerSchema.safeParse(await readJson(request));
  if (!parsed.success) return invalidBody("답을 한 줄이라도 써줄래?");

  const { id } = await context.params;

  try {
    const result = await answerCheckpoint(supabase, user.id, id, parsed.data.answer);
    if (!result.ok) return fail(result.code, result.message, result.status);
    return ok(result.data);
  } catch (cause) {
    return serverError("api/checkpoints/answer", cause);
  }
}
