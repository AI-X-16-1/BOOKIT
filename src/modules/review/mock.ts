/**
 * review 모듈 목 데이터.
 *
 * ⚠️ 임시다. Supabase 없이 목업대로 화면을 보기 위한 것이고,
 *    실제 Route Handler 가 붙으면 이 파일은 지운다.
 *
 * 리턴 타입은 전부 @/shared/types 의 API 계약 그대로다.
 * 나중에 함수 본문만 fetch 로 바꾸면 화면 코드는 손대지 않아도 된다.
 *
 *   export async function submitReview(id: string) {
 *     const r = await fetch(`/api/reviews/${id}/submit`, { method: "POST" });
 *     const { data } = await r.json();
 *     return data;
 *   }
 */

import type { Book, Review, SubmitReviewResponse } from "@/shared/types";

/** 네트워크가 있는 것처럼 보이게 하는 지연. 로딩 상태를 실제로 확인하려고 둔다. */
export const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

export const MOCK_BOOK: Book = {
  id: "0000b005-0000-4000-8000-000000000005",
  isbn13: "9788936434267",
  title: "아몬드",
  author: "손원평",
  publisher: "창비",
  cover_url: null,
  tags: ["성장", "한국소설"],
  target_grade_min: 6,
  target_grade_max: 9,
  is_public_domain: false,
  library_url: null,
  aladin_url: null,
};

/** 목업 2의 독후감 본문 그대로. */
export const MOCK_REVIEW_BODY =
  "이 책에서 가장 기억에 남는 부분은 곤이와 윤재가 다시 만나는 장면이다. " +
  "나는 처음에 윤재가 감정을 잘 느끼지 못한다는 설정이 단순히 특이한 캐릭터를 " +
  "위한 장치라고 생각했는데, 읽다 보니 그게 오히려 다른 사람들의 감정을 더 " +
  "정확히 관찰하게 만드는 이유가 된다는 걸 알게 됐다. 주인공은 결국 변화했다. " +
  "그리고 여러 사건이 있었다. 그래서 이 책은 감동적이었다.";

export const MOCK_REVIEW: Review = {
  id: "0000f001-0000-4000-8000-000000000001",
  student_id: "0000a001-0000-4000-8000-000000000001",
  book_id: MOCK_BOOK.id,
  body: MOCK_REVIEW_BODY,
  char_count: MOCK_REVIEW_BODY.length,
  status: "draft",
  is_shared: false,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

/** AI #1 — 글쓰기 도우미. 쓰기 전 길잡이 질문 하나 (목업 2 L78). */
export async function writingHelper(): Promise<{ question: string }> {
  await delay(300);
  return {
    question: "가장 인상 깊었던 장면은? 그 장면에서 인물의 감정은 어떻게 바뀌었어?",
  };
}

/**
 * POST /api/reviews/:id/submit — AI #2 빈틈 분석.
 * 목업 2 L112-123 의 세 가지 빈틈을 그대로 돌려준다.
 */
export async function submitReview(): Promise<SubmitReviewResponse> {
  await delay(1400);
  return {
    gaps: [
      {
        id: "0000f101-0000-4000-8000-000000000001",
        ord: 1,
        quote: "주인공은 결국 변화했다.",
        type: "unsupported_claim",
        reason: "어느 장면을 근거로 했는지 없어요",
      },
      {
        id: "0000f101-0000-4000-8000-000000000002",
        ord: 2,
        quote: "여러 사건이 있었다.",
        type: "vague_statement",
        reason: "어떤 사건인지 특정되지 않았어요",
      },
      {
        id: "0000f101-0000-4000-8000-000000000003",
        ord: 3,
        quote: "감동적이었다.",
        type: "feeling_only",
        reason: "인물·장면 연결이 없어요",
      },
    ],
  };
}
