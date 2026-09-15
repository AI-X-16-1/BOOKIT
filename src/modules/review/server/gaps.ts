/**
 * review/server/gaps — 저장된 빈틈을 화면 모양으로. owner: 박재경
 */
import "server-only";

import type { BookitClient } from "@/shared/supabase";
import type { ReviewGap, ReviewGapView } from "@/shared/types";

export function toGapView(gap: ReviewGap): ReviewGapView {
  return {
    id: gap.id,
    ord: gap.ord,
    quote: gap.quote,
    type: gap.gap_type,
    reason: gap.reason,
  };
}

/** ord 오름차순. 학생 본인 권한으로 읽는다 — review_gaps 는 본인 것만 보인다 (0003) */
export async function readGaps(
  supabase: BookitClient,
  reviewId: string,
): Promise<ReviewGapView[]> {
  const { data, error } = await supabase
    .from("review_gaps")
    .select("*")
    .eq("review_id", reviewId)
    .order("ord", { ascending: true });

  if (error) throw error;
  return (data ?? []).map(toGapView);
}
