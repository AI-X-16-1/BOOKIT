"use client";

import { useEffect, useRef, useState } from "react";
import { ApiClientError, apiPost } from "@/shared/api/client";
import type {
  AnswerResponse,
  QuestionResponse,
  ReviewGapView,
} from "@/shared/types";
import { GapAnalysisPanel } from "./GapAnalysisPanel";
import { QuestionPanel } from "./QuestionPanel";
import { ResultCard } from "./ResultCard";

/**
 * 빈틈 분석 → 질문 → 채점 → 재시도.
 *
 * 질문은 빈틈 분석 화면이 뜨자마자 뒤에서 미리 만든다 (CLAUDE.md §6).
 * "질문 받고 답하기"를 누르면 같은 라우트를 한 번 더 부르는데, 이때 서버는 새로 만들지 않고
 * 미리 만든 질문의 asked_at 만 지금으로 다시 찍는다 (server/question 의 restamp).
 * 그래서 빈틈 화면을 오래 봐도 제한 시간이 깎이지 않고, 카운트다운은 질문이 뜬 뒤 시작한다.
 */
export type VerificationStage = "gaps" | "question" | "result";

export interface VerificationFlowProps {
  reviewId: string;
  bookTitle: string;
  reviewBody: string;
  gaps: ReviewGapView[];
  streakDays: number;
  onDone: () => void;
}

function messageOf(cause: unknown): string {
  return cause instanceof ApiClientError
    ? cause.message
    : "잠깐 문제가 생겼어. 다시 해볼까?";
}

export function VerificationFlow({
  reviewId,
  bookTitle,
  reviewBody,
  gaps,
  streakDays,
  onDone,
}: VerificationFlowProps) {
  const [stage, setStage] = useState<VerificationStage>("gaps");
  const [question, setQuestion] = useState<QuestionResponse | null>(null);
  const [result, setResult] = useState<AnswerResponse | null>(null);
  const [attempt, setAttempt] = useState(1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const prepared = useRef<Promise<unknown>>(Promise.resolve());
  const preparedFor = useRef<string | null>(null);

  // 빈틈 화면을 보는 동안 질문을 미리 만든다. 실패해도 여기서는 넘긴다 —
  // 버튼을 누를 때 한 번 더 부르므로 그때 다시 만들어지거나 오류 문구가 뜬다.
  // StrictMode 의 이중 실행으로 두 번 만들러 가지 않게 id 로 한 번만 부른다.
  useEffect(() => {
    if (preparedFor.current === reviewId) return;
    preparedFor.current = reviewId;
    prepared.current = apiPost<QuestionResponse>(`/api/reviews/${reviewId}/question`, {}).catch(
      () => null,
    );
  }, [reviewId]);

  const run = async (task: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await task();
    } catch (cause) {
      setError(messageOf(cause));
    } finally {
      setBusy(false);
    }
  };

  const show = (next: QuestionResponse, nextAttempt: number) => {
    setQuestion(next);
    setAttempt(nextAttempt);
    setStage("question");
  };

  const ask = () =>
    run(async () => {
      await prepared.current;
      // 이 응답이 도착한 순간이 서버의 asked_at 이다
      show(await apiPost<QuestionResponse>(`/api/reviews/${reviewId}/question`, {}), attempt);
    });

  const answer = (text: string) =>
    run(async () => {
      if (!question) return;
      try {
        const graded = await apiPost<AnswerResponse>(
          `/api/verifications/${question.verification_id}/answer`,
          { answer: text },
        );
        setResult(graded);
        setStage("result");
      } catch (cause) {
        // 답이 채점까지 가지 못했다. 빈틈 화면으로 돌아가 다시 받게 한다 —
        // 답하지 않은 질문이면 서버가 같은 질문을 이어서 준다
        setStage("gaps");
        throw cause;
      }
    });

  /** 재시도는 서버가 **다른 빈틈**에서 새 질문을 만든다 (CLAUDE.md §6). */
  const retry = () =>
    run(async () => {
      show(await apiPost<QuestionResponse>(`/api/reviews/${reviewId}/retry`, {}), attempt + 1);
    });

  if (stage === "question" && question) {
    return (
      <QuestionPanel
        // 재시도마다 새로 마운트해서 답·타이머를 자연스럽게 초기화한다
        key={question.verification_id}
        question={question}
        attempt={attempt}
        onSubmit={answer}
        submitting={busy}
      />
    );
  }

  if (stage === "result" && result) {
    return (
      <ResultCard
        bookTitle={bookTitle}
        result={result}
        streakDays={streakDays}
        retrying={busy}
        error={error}
        onRetry={retry}
        onDone={onDone}
      />
    );
  }

  return (
    <GapAnalysisPanel
      bookTitle={bookTitle}
      reviewBody={reviewBody}
      gaps={gaps}
      loading={busy}
      error={error}
      onNext={ask}
    />
  );
}
