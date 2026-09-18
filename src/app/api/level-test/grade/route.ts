/**
 * POST /api/level-test/grade  { book_id, questions, answers }
 *   → { recommended_grade, confidence, feedback, current_grade }
 *
 * 읽기 수준 진단 판정 (AI #7). 소유: 박재경.
 *
 * 계약: docs/spec.md §5c.
 *
 * 추천만 돌려준다. 프로필을 여기서 바꾸지 않는다 — 학생이 결과를 보고 받아들이면
 * 화면이 기존 PATCH /api/profile 을 부른다. 진단이 조용히 학년을 바꾸면 안 된다.
 */
import type { NextRequest, NextResponse } from "next/server";

import { levelGradeSchema } from "@/modules/level";
import { finishLevelTest } from "@/modules/level/server";
import { fail, invalidBody, ok, readJson, serverError, unauthorized } from "@/shared/api";
import { createServerSupabase } from "@/shared/supabase/server";
import type { ApiResponse } from "@/shared/types";

interface GradeResponse {
  recommended_grade: number;
  confidence: "low" | "medium" | "high";
  feedback: string;
  current_grade: number | null;
}

export async function POST(
  request: NextRequest,
): Promise<NextResponse<ApiResponse<GradeResponse>>> {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return unauthorized();

  const parsed = levelGradeSchema.safeParse(await readJson(request));
  if (!parsed.success) return invalidBody("답을 다시 확인해줄래?");

  try {
    const result = await finishLevelTest(
      supabase,
      user.id,
      parsed.data.book_id,
      parsed.data.questions,
      parsed.data.answers,
    );
    if (!result.ok) return fail(result.code, result.message, result.status);

    const { recommendedGrade, confidence, feedback, currentGrade } = result.data;
    return ok({
      recommended_grade: recommendedGrade,
      confidence,
      feedback,
      current_grade: currentGrade,
    });
  } catch (cause) {
    return serverError("level-test/grade", cause);
  }
}
