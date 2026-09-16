"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { VerificationFlow } from "@/modules/verification";
import { ApiClientError, apiPatch, apiPost } from "@/shared/api/client";
import type {
  CreateReviewResponse,
  ReviewGapView,
  SubmitReviewResponse,
  UpdateReviewResponse,
  WritingHelperResult,
} from "@/shared/types";
import type { WriteSession } from "../schema";
import { ReviewEditor } from "./ReviewEditor";

/**
 * 독후감 작성 → 검증까지의 전체 흐름.
 *
 * 768px 미만에서는 작성과 AI 패널이 순차 단계로 이어지고,
 * 768px 이상에서는 나란히 놓인다 (CLAUDE.md §8).
 *
 * 초고는 글쓰기 도우미를 부를 때(화면이 열릴 때) 또는 처음 저장할 때 만든다
 * (POST /api/reviews). 한 글자도 없는 초고는 홈의 "이어서 쓰기"에서 걸러진다 —
 * server/reviews 의 findResumable.
 */
export type WriteFlowProps = WriteSession;

/**
 * 빈틈도 0개인데 되물을 핵심 문장까지 못 고른 드문 경우.
 * 빈틈 0개 자체는 core_claim 질문 하나로 이어진다 (issue #14) — review/server/submit 참고.
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
  const [helperQuestion, setHelperQuestion] = useState<string>();

  const reviewId = useRef<string | null>(review?.id ?? null);
  const creating = useRef<Promise<string> | null>(null);
  const saving = useRef<Promise<void>>(Promise.resolve());
  const helperAsked = useRef(false);

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

  /**
   * 글쓰기 도우미(AI #1). 빈 화면 앞에서 얼어붙지 않게 화면이 열리자마자 받아 온다.
   * 쓰기 "전" 질문이라 이어 쓰던 본문이 있거나 이미 제출한 뒤에는 부르지 않는다.
   * 실패하면 상자 없이 그대로 쓴다 (docs/spec.md §5) — 힌트 하나 때문에 작성을 막지 않는다.
   *
   * 부르려면 초고 id 가 필요해서 여기서 초고를 만든다. 책을 고르고 작성 화면까지 온
   * 자리라 초고를 만들 만하고, 한 글자도 없는 초고는 홈의 "이어서 쓰기"에서 걸러진다
   * (server/reviews 의 findResumable). StrictMode 의 이중 실행은 ref 로 막는다.
   */
  useEffect(() => {
    if (helperAsked.current || checked || body.trim()) return;
    helperAsked.current = true;
    void ensureReview()
      .then((id) => apiPost<WritingHelperResult>(`/api/reviews/${id}/helper`, {}))
      .then(({ question }) => setHelperQuestion(question))
      .catch(() => undefined);
  }, [body, checked, ensureReview]);

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

  /**
   * 질문을 끝내 못 만든 경우. 검증 화면을 닫고 작성으로 돌아간다 —
   * 서버가 이미 초고로 돌려놨으니 자동 저장도 다시 열린다 (verification/server/question).
   */
  const rewrite = (message: string) => {
    setChecked(null);
    setNotice(message);
  };

  const editor = (
    <ReviewEditor
      bookTitle={book.title}
      bookAuthor={book.author}
      helperQuestion={helperQuestion}
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
          onRewrite={rewrite}
        />
      </div>
    </div>
  );
}
