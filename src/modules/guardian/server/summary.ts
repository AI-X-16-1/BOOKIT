/**
 * guardian/server/summary — 토큰으로 학생 현황 조회. owner: 문민재
 *
 * docs/spec.md §5: GET /api/guardian/:token → { summary, books[] }   인증 없음
 *
 * service role 로만 조회한다 (0005 마이그레이션 주석, docs/spec.md §3) —
 * anon 에게 RLS 를 열면 토큰을 모르는 사람도 테이블을 훑을 수 있다.
 * 그래서 여기서는 RLS 가 아니라 이 파일의 select 목록이 유일한 방어선이다:
 * reviews.body 와 verifications.answer 는 절대 select 하지 않는다 (CLAUDE.md §5).
 *
 * 이해도 점수는 teacher 모듈의 v_teacher_student_progress 뷰가 쓰는
 * comprehension_score() 와 같은 가중치다 (0003) — 교사가 보는 점수와
 * 보호자가 보는 점수가 다른 공식으로 갈리면 안 된다. RPC 로 행마다 부르는
 * 대신 같은 가중치를 여기 그대로 옮겨서 세 축 배열에 한 번에 적용한다.
 */
import "server-only";

import { createAdminClient } from "@/shared/supabase/admin";
import type {
  GuardianSummaryResponse,
  ScoreAxis,
  StyleAxis,
} from "@/shared/types";

import { type GuardianResult, failure, unexpected } from "./result";

const TOKEN_INVALID = "링크가 만료됐어. 새 링크를 받아줘.";

/** 0003 의 comprehension_score(logic, spec, style) 와 같은 공식 */
function comprehensionScore(
  logic: ScoreAxis,
  spec: ScoreAxis,
  style: StyleAxis,
): number {
  const axis = (v: ScoreAxis) => (v === "pass" ? 1 : v === "weak" ? 0.5 : 0);
  const styleScore = style === "same" ? 1 : 0;
  return Math.round((100 * (axis(logic) + axis(spec) + styleScore)) / 3);
}

/** GET /api/guardian/:token */
export async function getGuardianSummary(
  token: string,
): Promise<GuardianResult<GuardianSummaryResponse>> {
  const admin = createAdminClient();

  const link = await admin
    .from("guardian_links")
    .select("student_id, revoked_at")
    .eq("token", token)
    .maybeSingle();

  if (link.error) return unexpected("summary:link", link.error);
  if (!link.data || link.data.revoked_at) {
    return failure("token_invalid", TOKEN_INVALID, 404);
  }
  const studentId = link.data.student_id;

  const [profileRes, pointsRes, reviewsRes, verificationsRes] = await Promise.all([
    admin.from("profiles").select("display_name").eq("id", studentId).maybeSingle(),
    admin.from("points_ledger").select("delta").eq("student_id", studentId),
    admin
      .from("reviews")
      .select("book_id, status, created_at")
      .eq("student_id", studentId)
      .order("created_at", { ascending: false }),
    admin
      .from("verifications")
      .select("logic_consistency, specificity, style_consistency, passed")
      .eq("student_id", studentId),
  ]);

  if (profileRes.error) return unexpected("summary:profile", profileRes.error);
  if (pointsRes.error) return unexpected("summary:points", pointsRes.error);
  if (reviewsRes.error) return unexpected("summary:reviews", reviewsRes.error);
  if (verificationsRes.error) return unexpected("summary:verifications", verificationsRes.error);

  // 학생 행이 지워졌는데 토큰만 남는 경우는 없다(on delete cascade, 0005) — 그래도 방어적으로.
  if (!profileRes.data) return failure("token_invalid", TOKEN_INVALID, 404);

  const points = (pointsRes.data ?? []).reduce((sum, row) => sum + row.delta, 0);

  const passedScores = (verificationsRes.data ?? [])
    .filter((v) => v.passed)
    .map((v) =>
      comprehensionScore(
        v.logic_consistency ?? "fail",
        v.specificity ?? "fail",
        v.style_consistency ?? "same",
      ),
    );
  const avgScore = passedScores.length
    ? Math.round(passedScores.reduce((sum, s) => sum + s, 0) / passedScores.length)
    : 0;

  const reviews = reviewsRes.data ?? [];
  const completedCount = reviews.filter((r) => r.status === "passed").length;

  const bookIds = [...new Set(reviews.map((r) => r.book_id))];
  const booksRes = bookIds.length
    ? await admin.from("books").select("id, title, author, cover_url").in("id", bookIds)
    : { data: [], error: null };
  if (booksRes.error) return unexpected("summary:books", booksRes.error);

  const bookById = new Map((booksRes.data ?? []).map((b) => [b.id, b]));
  const books = reviews.flatMap((r) => {
    const book = bookById.get(r.book_id);
    if (!book) return [];
    return [
      {
        title: book.title,
        author: book.author,
        cover_url: book.cover_url,
        passed: r.status === "passed",
      },
    ];
  });

  return {
    ok: true,
    data: {
      summary: {
        display_name: profileRes.data.display_name,
        completed_count: completedCount,
        points,
        avg_score: avgScore,
      },
      books,
    },
  };
}
