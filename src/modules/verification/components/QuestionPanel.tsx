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

  const pct = (left / question.seconds) * 100;

  return (
    <div className="-mx-[22px] -mt-[44px] flex min-h-dvh flex-col bg-panel px-[22px] pt-[52px] pb-[26px] md:mx-0 md:mt-0 md:min-h-0 md:flex-1 md:rounded-card md:pt-8">
      {/* 저학년 개편(목업 10 M06): 🦉 한 가지만 물어볼게 → 원형 타이머 → 네가 쓴 문장 → 질문 → 답 → 답했어! */}
      <div className="flex items-center gap-3">
        <span aria-hidden className="flex h-[46px] w-[46px] items-center justify-center rounded-full bg-panel-inner text-[24px] animate-[bookit-bob-s_3s_ease-in-out_infinite]">🦉</span>
        <span className="font-display text-[24px] text-on-dark">한 가지만 물어볼게</span>
      </div>

      {/* 원형 타이머 — 표시용. 진실은 서버의 asked_at / answered_at */}
      <div className="relative mx-auto mt-5 h-[150px] w-[150px] flex-none">
        <div
          className="absolute inset-0 rounded-full transition-[background] duration-1000 ease-linear"
          style={{ background: `conic-gradient(var(--yellow) 0turn ${pct / 100}turn, var(--panel-line) ${pct / 100}turn 1turn)` }}
        />
        <div className="absolute inset-3 flex flex-col items-center justify-center rounded-full bg-panel">
          <span className="font-display text-[48px] leading-none text-yellow tabular-nums">{left}</span>
          <span className="mt-1 text-[14px] font-medium text-on-dark-2">초 남았어</span>
        </div>
      </div>

      {/* 네가 쓴 문장 */}
      <div className="mt-5 rounded-[22px] border-2 border-panel-line bg-panel-inner px-[18px] py-4">
        <div className="text-[14px] font-medium text-on-dark-2">네가 쓴 문장이야</div>
        <div className="mt-[7px] text-[19px] leading-[1.7] text-on-dark">
          &ldquo;<span className="font-bold text-coral-light">{question.quote}</span>&rdquo;
        </div>
      </div>

      {/* 질문 */}
      <div className="mt-5 text-center font-display text-[28px] leading-[1.35] text-on-dark">
        {question.question}
      </div>
      <div className="mt-1.5 text-center font-display text-[19px] text-yellow">한 문장이면 충분해</div>

      {/* 답변 */}
      <textarea
        autoFocus
        value={answer}
        onChange={(e) => setAnswer(e.target.value)}
        disabled={submitting}
        placeholder="여기에 답을 써줘"
        className="mt-4 min-h-[110px] flex-1 resize-none rounded-[22px] border-[3px] border-panel-line bg-[#211A15] px-[18px] py-4 text-[18px] leading-[1.7] text-panel-text caret-yellow outline-none placeholder:text-panel-muted"
      />

      <p className="mt-3.5 text-center text-[16px] font-medium text-on-dark-2">
        {attempt > 1 ? "아까와 다른 걸 물어봤어" : "천천히 생각해도 괜찮아"}
      </p>

      <div className="pt-3">
        <Button
          onClick={() => handleSubmit(answer)}
          disabled={submitting}
          className="bg-yellow text-[#4A3A10] shadow-[var(--shadow-press-y)]"
        >
          {submitting ? "확인하고 있어…" : "답했어!"}
        </Button>
      </div>
    </div>
  );
}
