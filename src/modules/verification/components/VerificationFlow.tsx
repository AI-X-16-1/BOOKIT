"use client";

import { useState } from "react";
import type {
  AnswerResponse,
  QuestionResponse,
  ReviewGapView,
} from "@/shared/types";
import { GapAnalysisPanel } from "./GapAnalysisPanel";
import { QuestionPanel } from "./QuestionPanel";
import { ResultCard } from "./ResultCard";
import { requestQuestion, submitAnswer } from "../mock";

/**
 * 빈틈 분석 → 질문 → 채점 → 재시도.
 *
 * 실제 구현에서는 질문을 독후감 제출 직후(빈틈 분석 화면을 보는 동안) 미리 만들어 두고,
 * 카운트다운은 질문이 화면에 뜬 뒤에 시작한다 (CLAUDE.md §6).
 * 여기서는 목이라 "질문 받고 답하기"를 누를 때 만든다.
 */
export type VerificationStage = "gaps" | "question" | "result";

export interface VerificationFlowProps {
  bookTitle: string;
  reviewBody: string;
  gaps: ReviewGapView[];
  streakDays: number;
  onDone: () => void;
}

export function VerificationFlow({
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

  /** 재시도는 attempt 를 올려 **다른 빈틈**에서 새 질문을 받는다 (CLAUDE.md §6). */
  const ask = async (nextAttempt: number) => {
    setBusy(true);
    const q = await requestQuestion(gaps, nextAttempt);
    setQuestion(q);
    setAttempt(nextAttempt);
    setBusy(false);
    setStage("question");
  };

  const answer = async (text: string) => {
    setBusy(true);
    const r = await submitAnswer(text, reviewBody);
    setResult(r);
    setBusy(false);
    setStage("result");
  };

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
        onRetry={() => ask(attempt + 1)}
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
      onNext={() => ask(1)}
    />
  );
}
