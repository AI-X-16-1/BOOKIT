"use client";

import { useEffect, useRef, useState } from "react";
import type { QuestionResponse } from "@/shared/types";
import { Button } from "@/shared/ui";

/**
 * AI 꼬리질문 화면. 목업 3 #1 (docs/mockups/3 AI 검증 질문·결과.dc.html L35-53).
 *
 * 의도적으로 어둡다. 이 대비가 "지금 확인받는 중"을 뜻하고,
 * 다른 화면 톤에 맞춰 밝게 펴면 안 된다 (CLAUDE.md §7).
 *
 * 카운트다운은 질문이 화면에 뜬 뒤에 시작한다 (CLAUDE.md §6).
 * 실제 구현에서는 서버의 asked_at / answered_at 이 진실의 원천이고,
 * 이 타이머는 표시용일 뿐이다 (docs/spec.md §5).
 */
export interface QuestionPanelProps {
  question: QuestionResponse;
  attempt: number;
  onSubmit: (answer: string) => void;
  submitting?: boolean;
}

export function QuestionPanel({
  question,
  attempt,
  onSubmit,
  submitting = false,
}: QuestionPanelProps) {
  const [answer, setAnswer] = useState("");
  const [left, setLeft] = useState(question.seconds);
  const submitted = useRef(false);

  const handleSubmit = (text: string) => {
    if (submitted.current) return;
    submitted.current = true;
    onSubmit(text);
  };

  // 재시도로 질문이 바뀌면 부모가 key 를 갈아끼워 이 컴포넌트를 새로 마운트한다.
  // 그래서 답·타이머·제출 플래그를 effect 로 되돌릴 필요가 없다.
  useEffect(() => {
    if (submitting) return;
    const t = setInterval(() => setLeft((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(t);
  }, [submitting]);

  // 시간이 다 되면 쓴 만큼 자동 제출한다 — 답을 날려서 벌주지 않는다
  useEffect(() => {
    if (left === 0) handleSubmit(answer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [left]);

  const mm = String(Math.floor(left / 60)).padStart(2, "0");
  const ss = String(left % 60).padStart(2, "0");
  const pct = (left / question.seconds) * 100;

  return (
    <div className="-mx-[22px] -mt-[52px] flex min-h-dvh flex-col bg-panel px-[22px] pt-[52px] pb-[26px] md:mx-0 md:mt-0 md:min-h-0 md:flex-1 md:rounded-card md:pt-8">
      <div className="flex items-baseline justify-between">
        <span className="text-[19px] font-bold text-on-dark">
          책잇 AI가 물어봐
        </span>
        <span className="text-[17px] font-bold text-yellow tabular-nums">
          {mm}:{ss}
        </span>
      </div>

      {/* 남은 시간 막대 */}
      <div className="mt-3 h-1 rounded-full bg-panel-line">
        <div
          className="h-1 rounded-full bg-coral transition-[width] duration-1000 ease-linear"
          style={{ width: `${pct}%` }}
        />
      </div>

      {/* 네가 쓴 문장 */}
      <div className="mt-[22px] rounded-xl bg-panel-inner p-4">
        <div className="text-xs text-panel-muted">네가 쓴 문장</div>
        <div className="mt-[7px] text-[15px] text-panel-text">
          &ldquo;{question.quote}&rdquo;
        </div>
      </div>

      {/* 질문 */}
      <div className="mt-3.5 rounded-xl bg-card p-5 text-[17px] leading-[1.65] text-ink">
        {question.question}
      </div>

      {/* 답변 */}
      <textarea
        autoFocus
        value={answer}
        onChange={(e) => setAnswer(e.target.value)}
        disabled={submitting}
        placeholder="떠오르는 대로 적어도 괜찮아."
        className="mt-3.5 min-h-40 flex-1 resize-none rounded-xl bg-panel-inner p-[18px] text-base leading-[1.75] text-panel-text caret-coral-light outline-none placeholder:text-panel-muted"
      />

      <p className="mt-3.5 text-center text-xs text-panel-muted">
        {attempt > 1
          ? "아까와 다른 문장으로 새로 물어봤어"
          : "질문은 제출할 때마다 새로 만들어져요"}
      </p>

      <div className="pt-3">
        <Button onClick={() => handleSubmit(answer)} disabled={submitting}>
          {submitting ? "확인하고 있어…" : "답변 제출"}
        </Button>
      </div>
    </div>
  );
}
