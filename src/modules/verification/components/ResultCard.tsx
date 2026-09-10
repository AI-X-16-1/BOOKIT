"use client";

import type { AnswerResponse } from "@/shared/types";
import { Button } from "@/shared/ui";
import { axisLabel } from "../mock";

/**
 * 채점 결과. 목업 3 #2 (docs/mockups/3 AI 검증 질문·결과.dc.html L61-95).
 *
 * 통과 화면은 목업 그대로다. 실패 화면은 목업에 없어서
 * 같은 카드 구조를 쓰되 CLAUDE.md §9 의 톤으로 만들었다 —
 * 실패를 벌처럼 보이게 하지 않고, 무엇을 더하면 되는지 말하고 재시도를 준다.
 * 그래서 실패 쪽에는 완독 도장도, 책갈피 줄도, 장식 별도 없다.
 */
export interface ResultCardProps {
  bookTitle: string;
  result: AnswerResponse;
  streakDays: number;
  onRetry: () => void;
  onDone: () => void;
  retrying?: boolean;
}

export function ResultCard({
  bookTitle,
  result,
  streakDays,
  onRetry,
  onDone,
  retrying = false,
}: ResultCardProps) {
  const { passed, scores, feedback, points } = result;

  return (
    <div className="-mx-[22px] -mt-[52px] flex min-h-dvh items-center bg-notebook px-[22px] md:mx-0 md:mt-0 md:min-h-0 md:flex-1 md:rounded-card md:py-10">
      <div className="relative w-full">
        {/* 장식 별 — 통과했을 때만 */}
        {passed && (
          <>
            <span className="absolute -top-24 left-6 text-xl text-star-warm">
              ★
            </span>
            <span className="absolute -bottom-28 right-8 text-xl text-star-cool">
              ★
            </span>
          </>
        )}

        <div className="relative rounded-3xl bg-card px-[26px] py-8 shadow-card">
          {/* 완독 도장 — 통과했을 때만 */}
          {passed && (
            <div className="absolute -top-[22px] -right-[18px] flex h-[82px] w-[82px] -rotate-8 flex-col items-center justify-center rounded-full border-[3px] border-dashed border-stamp-ring bg-yellow shadow-[0_8px_20px_rgba(90,66,40,.18)]">
              <span className="text-base text-yellow-text">★</span>
              <span className="text-[13px] font-bold text-stamp-text">완독</span>
            </div>
          )}

          <div className="flex items-center gap-[13px]">
            <div className="h-11 w-11 flex-none rounded-[10px] bg-linear-160 from-green-light to-green" />
            <div className="min-w-0">
              <div className="truncate text-[13px] text-muted">
                {bookTitle} · 독후감
              </div>
              <div className="mt-[3px] text-base font-bold text-ink">
                AI 이해도 확인 결과
              </div>
            </div>
          </div>

          <div className="mt-[26px] flex items-center gap-4">
            <div
              className={`flex h-14 w-14 flex-none items-center justify-center rounded-full text-[26px] text-white ${passed ? "bg-green" : "bg-coral"}`}
            >
              {passed ? "✓" : "!"}
            </div>
            <div className="text-[28px] leading-tight font-bold text-ink">
              {passed ? "완독! 통과했어요" : "조금만 더!"}
            </div>
          </div>

          {/* AI 피드백 */}
          <div className="mt-6 rounded-[14px] bg-yellow-bg p-[18px]">
            <div className="text-sm font-bold text-yellow-text">
              ✎ 책잇 AI 피드백
            </div>
            <p className="mt-[7px] text-[15px] leading-[1.7] text-yellow-text-2">
              {feedback}
            </p>
          </div>

          {/* 점수 2축 */}
          <div className="mt-3.5 grid grid-cols-2 gap-2.5">
            <div className="rounded-xl bg-sunken p-3.5">
              <div className="text-xs text-muted">정합성</div>
              <div className="mt-1 text-xl font-bold text-ink">
                {axisLabel(scores.logic_consistency)}
              </div>
            </div>
            <div className="rounded-xl bg-sunken p-3.5">
              <div className="text-xs text-muted">구체성</div>
              <div className="mt-1 text-xl font-bold text-ink">
                {axisLabel(scores.specificity)}
              </div>
            </div>
          </div>

          {/* 책갈피 — 통과했을 때만. 실패는 0점을 강조하지 않는다 */}
          {passed && (
            <>
              <div className="mt-3.5 flex items-center justify-between rounded-[14px] bg-ink p-5">
                <span className="text-[17px] font-bold text-on-dark">
                  🔖 책갈피 획득
                </span>
                <span className="text-[26px] font-bold text-coral-light">
                  +{points}
                </span>
              </div>
              <p className="mt-3 text-center text-sm text-ink-warm">
                {streakDays}일째 연속으로 통과하고 있어요 🔥
              </p>
            </>
          )}

          <div className="mt-4 flex gap-2.5">
            {passed ? (
              <>
                <Button onClick={onDone}>다음 책 보러가기</Button>
                <Button variant="dark" fullWidth={false} className="flex-none px-[18px]">
                  ⤳ 공유
                </Button>
              </>
            ) : (
              <>
                <Button onClick={onRetry} disabled={retrying}>
                  {retrying ? "새 질문을 만들고 있어…" : "다시 답해볼까?"}
                </Button>
                <Button
                  variant="outline"
                  fullWidth={false}
                  onClick={onDone}
                  className="flex-none px-[18px]"
                >
                  나중에
                </Button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
