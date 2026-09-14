"use client";

import { useCallback, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { VerificationFlow } from "@/modules/verification";
import { ApiClientError, apiPatch, apiPost } from "@/shared/api/client";
import type {
  CreateReviewResponse,
  ReviewGapView,
  SubmitReviewResponse,
  UpdateReviewResponse,
} from "@/shared/types";
import type { WriteSession } from "../schema";
import { ReviewEditor } from "./ReviewEditor";

/**
 * 독후감 작성 → 검증까지의 전체 흐름.
 *
 * 768px 미만에서는 작성과 AI 패널이 순차 단계로 이어지고,
 * 768px 이상에서는 나란히 놓인다 (CLAUDE.md §8).
 *
 * 초고는 처음 저장할 때 만든다 (POST /api/reviews). 화면에 들어오기만 해도
 * 빈 초고가 생기면 홈의 "이어서 쓰기"가 빈 독후감을 가리키게 된다.
 */
export type WriteFlowProps = WriteSession;

/**
 * 빈틈이 0개일 때. docs/prompts.md §2 는 "바로 통과"라고 하지만 통과 기록에
 * gap_id 가 필요해서 지금은 한 문장 더 쓰게 한다 — review/server/submit 참고.
 */
const NO_GAPS_NOTICE =
  "빈틈을 하나도 못 찾았어! 가장 기억에 남는 장면을 한 줄만 더 써주면 질문을 만들어 볼게.";

function messageOf(cause: unknown): string {
  return cause instanceof ApiClientError
    ? cause.message
    : "잠깐 문제가 생겼어. 다시 해볼까?";
}

export function WriteFlow({ book, review, gaps: savedGaps, streakDays }: WriteFlowProps) {
  const router = useRouter();
  const [body, setBody] = useState(review?.body ?? "");
  // 빈틈 분석이 끝난 독후감. 이 값이 있으면 본문이 잠기고 검증 화면이 열린다
  const [checked, setChecked] = useState<{
    reviewId: string;
    gaps: ReviewGapView[];
  } | null>(review && savedGaps.length > 0 ? { reviewId: review.id, gaps: savedGaps } : null);
  const [submitting, setSubmitting] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const reviewId = useRef<string | null>(review?.id ?? null);
  const creating = useRef<Promise<string> | null>(null);
  const saving = useRef<Promise<void>>(Promise.resolve());

  /** 초고 id. 없으면 만든다 — 동시에 여러 번 불려도 한 번만 만든다 */
  const ensureReview = useCallback((): Promise<string> => {
    if (reviewId.current) return Promise.resolve(reviewId.current);
    creating.current ??= apiPost<CreateReviewResponse>("/api/reviews", {
      book_id: book.id,
    }).then(
      ({ review: created }) => (reviewId.current = created.id),
      (cause: unknown) => {
        creating.current = null;
        throw cause;
      },
    );
    return creating.current;
  }, [book.id]);

  /** 저장은 한 줄로 세운다. 늦게 출발한 저장이 먼저 도착해 옛 본문으로 덮이는 걸 막는다 */
  const save = useCallback(
    (text: string): Promise<void> => {
      const next = saving.current
        .catch(() => undefined)
        .then(async () => {
          const id = await ensureReview();
          await apiPatch<UpdateReviewResponse>(`/api/reviews/${id}`, { body: text });
        });
      saving.current = next;
      return next;
    },
    [ensureReview],
  );

  const submit = async () => {
    setSubmitting(true);
    setNotice(null);
    try {
      // 디바운스를 기다리지 않고 지금 본문을 먼저 저장한다
      try {
        await save(body);
      } catch (cause) {
        // 이미 제출된 독후감(제출 응답을 못 받고 다시 누른 경우) — 제출이 같은 빈틈을 돌려준다
        if (!(cause instanceof ApiClientError && cause.code === "review_locked")) throw cause;
      }
      const id = await ensureReview();
      const { gaps } = await apiPost<SubmitReviewResponse>(`/api/reviews/${id}/submit`, {});
      if (gaps.length === 0) setNotice(NO_GAPS_NOTICE);
      else setChecked({ reviewId: id, gaps });
    } catch (cause) {
      setNotice(messageOf(cause));
    } finally {
      setSubmitting(false);
    }
  };

  const editor = (
    <ReviewEditor
      bookTitle={book.title}
      bookAuthor={book.author}
      value={body}
      onChange={setBody}
      onAutosave={save}
      onSubmit={submit}
      submitting={submitting}
      locked={checked !== null}
      notice={notice}
    />
  );

  if (!checked) {
    return <div className="flex min-h-0 flex-1 flex-col">{editor}</div>;
  }

  // 검증 화면은 한 번만 그린다. 두 벌을 그리면 둘 다 질문을 미리 만들러 간다.
  // 768px 미만에서는 작성 화면을 숨겨 순차 단계가 되고, 이상에서는 나란히 놓인다
  return (
    <div className="flex min-h-0 flex-1 gap-6">
      <div className="hidden min-w-0 flex-1 flex-col md:flex">{editor}</div>
      <div className="flex min-w-0 flex-1 flex-col">
        <VerificationFlow
          reviewId={checked.reviewId}
          bookTitle={book.title}
          reviewBody={body}
          gaps={checked.gaps}
          streakDays={streakDays}
          onDone={() => router.push("/home")}
        />
      </div>
    </div>
  );
}
