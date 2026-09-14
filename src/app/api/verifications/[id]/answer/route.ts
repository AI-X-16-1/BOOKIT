/**
 * POST /api/verifications/:id/answer  { answer } → { passed, scores, feedback, points }
 *
 * 소유: 박재경 (docs/spec.md §5).
 * 얇게 유지한다 — 판단은 modules/verification 의 gradeAnswer 가 한다 (CLAUDE.md §2).
 *
 * 제한 시간 판정은 클라이언트 타이머가 아니라 서버의 asked_at 으로만 한다.
 * 시간이 지나 도착한 답도 오류가 아니라 실패한 시도로 기록된다 — 실패도 행을 남기고
 * 재시도로 이어져야 한다 (CLAUDE.md §4, §9).
 */

import type { NextRequest, NextResponse } from "next/server";

import { answerSchema } from "@/modules/verification";
import { gradeAnswer } from "@/modules/verification/server";
import {
  fail,
  invalidBody,
  ok,
  readJson,
  serverError,
  unauthorized,
} from "@/shared/api";
import { createServerSupabase } from "@/shared/supabase/server";
import type { AnswerResponse, ApiResponse } from "@/shared/types";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse<ApiResponse<AnswerResponse>>> {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return unauthorized();

  const parsed = answerSchema.safeParse(await readJson(request));
  if (!parsed.success) return invalidBody("답이 너무 길어. 조금만 줄여줄래?");

  const { id } = await params;

  try {
    const result = await gradeAnswer(supabase, user.id, id, parsed.data.answer);
    if (!result.ok) return fail(result.code, result.message, result.status);
    return ok(result.data);
  } catch (cause) {
    return serverError("verification:answer", cause);
  }
}
