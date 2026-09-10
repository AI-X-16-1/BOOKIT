"use client";

import { useEffect, useState } from "react";
import type { ReviewGapView } from "@/shared/types";
import { VerificationFlow } from "@/modules/verification";
import { ReviewEditor } from "./ReviewEditor";
import {
  MOCK_BOOK,
  MOCK_REVIEW_BODY,
  submitReview,
  writingHelper,
} from "../mock";

/**
 * 독후감 작성 → 검증까지의 전체 흐름.
 *
 * 768px 미만에서는 작성과 AI 패널이 순차 단계로 이어지고,
 * 768px 이상에서는 나란히 놓인다 (CLAUDE.md §8).
 *
 * ⚠️ 목 데이터로 도는 화면이다. 실제 API 가 붙으면 ../mock 임포트만 바꾸면 된다.
 */
export function WriteFlow() {
  const [body, setBody] = useState(MOCK_REVIEW_BODY);
  const [helper, setHelper] = useState("");
  const [gaps, setGaps] = useState<ReviewGapView[] | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    writingHelper().then((r) => setHelper(r.question));
  }, []);

  const submit = async () => {
    setSubmitting(true);
    const { gaps: found } = await submitReview();
    setGaps(found);
    setSubmitting(false);
  };

  const reset = () => {
    setGaps(null);
    setBody(MOCK_REVIEW_BODY);
  };

  const editor = (
    <ReviewEditor
      bookTitle={MOCK_BOOK.title}
      bookAuthor={MOCK_BOOK.author}
      helperQuestion={helper}
      value={body}
      onChange={setBody}
      onSubmit={submit}
      submitting={submitting}
    />
  );

  const verification = gaps ? (
    <VerificationFlow
      bookTitle={MOCK_BOOK.title}
      reviewBody={body}
      gaps={gaps}
      streakDays={7}
      onDone={reset}
    />
  ) : null;

  // 768px 미만 — 순차 단계
  if (!verification) {
    return <div className="flex min-h-0 flex-1 flex-col">{editor}</div>;
  }

  return (
    <>
      <div className="flex min-h-0 flex-1 flex-col md:hidden">{verification}</div>
      {/* 768px 이상 — 작성과 AI 패널을 나란히 */}
      <div className="hidden min-h-0 flex-1 gap-6 md:flex">
        <div className="flex min-w-0 flex-1 flex-col">{editor}</div>
        <div className="flex min-w-0 flex-1 flex-col">{verification}</div>
      </div>
    </>
  );
}
