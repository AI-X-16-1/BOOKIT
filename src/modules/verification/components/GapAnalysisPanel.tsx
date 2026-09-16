"use client";

import type { ReviewGapView } from "@/shared/types";
import { Button, Card, Chip } from "@/shared/ui";
import { GAP_CARD_TEXT, GAP_HIGHLIGHT, GAP_LABEL, GAP_TONE, type GapTone } from "./labels";

/**
 * 빈틈 분석 결과. 목업 2 #3 (docs/mockups/2 독후감 작성.dc.html L97-127).
 *
 * 독후감 본문에서 지적된 문장을 그대로 하이라이트한다.
 * 코랄 = 근거 없이 단정, 옐로 = 나머지.
 *
 * 빈틈이 0개였던 독후감은 core_claim 한 줄만 들어온다 (issue #14). 그때는 지적이 아니라
 * 칭찬이라 초록으로 바꾸고 "빈틈 0곳"이라고 적는다 — 질문은 그대로 하나 받는다.
 */
export interface GapAnalysisPanelProps {
  bookTitle: string;
  reviewBody: string;
  gaps: ReviewGapView[];
  onNext: () => void;
  loading?: boolean;
  /** 질문을 못 받아 왔거나 답이 채점까지 못 갔을 때. 아이가 그대로 읽는 문장이다 */
  error?: string | null;
}

/** 빈틈 0개 — 아이가 그대로 읽는 문장이다 (CLAUDE.md §9, issue #14 댓글 문구). */
const NO_GAPS_NOTICE = "이번엔 빈틈이 없었어! 그래도 하나만 물어볼게.";

/** 본문에서 각 빈틈 인용문을 찾아 하이라이트한 조각으로 쪼갠다. */
function highlight(body: string, gaps: ReviewGapView[]) {
  const parts: Array<{ text: string; tone?: GapTone }> = [];
  let rest = body;

  while (rest.length > 0) {
    // 남은 본문에서 가장 먼저 등장하는 인용문을 찾는다
    let bestAt = -1;
    let best: ReviewGapView | null = null;
    for (const g of gaps) {
      const at = rest.indexOf(g.quote);
      if (at !== -1 && (bestAt === -1 || at < bestAt)) {
        bestAt = at;
        best = g;
      }
    }
    if (!best || bestAt === -1) {
      parts.push({ text: rest });
      break;
    }
    if (bestAt > 0) parts.push({ text: rest.slice(0, bestAt) });
    parts.push({ text: best.quote, tone: GAP_TONE[best.type] });
    rest = rest.slice(bestAt + best.quote.length);
  }
  return parts;
}

export function GapAnalysisPanel({
  bookTitle,
  reviewBody,
  gaps,
  onNext,
  loading = false,
  error = null,
}: GapAnalysisPanelProps) {
  const parts = highlight(reviewBody, gaps);
  // 빈틈이 0개여서 핵심 문장 하나만 물어보는 경우 (issue #14)
  const noGaps = gaps.length > 0 && gaps.every((g) => g.type === "core_claim");

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center gap-3">
        <div className="h-9 w-9 flex-none rounded-[9px] bg-linear-160 from-green-light to-green" />
        <div className="min-w-0 flex-1">
          <div className="text-[17px] font-bold text-ink">빈틈 분석 결과</div>
          <div className="mt-0.5 truncate text-[13px] text-muted">
            {bookTitle} · 독후감
          </div>
        </div>
        {noGaps ? (
          <Chip tone="green">빈틈 0곳</Chip>
        ) : (
          <Chip tone="blue">{gaps.length}곳</Chip>
        )}
      </div>

      {noGaps && (
        <p className="mt-3 text-sm font-bold text-green-text">{NO_GAPS_NOTICE}</p>
      )}

      {/* 본문 + 하이라이트 */}
      <div className="mt-4 rounded-[14px] border border-border-soft bg-card p-[18px] text-[15px] leading-[2] text-ink-soft">
        {parts.map((p, i) =>
          p.tone ? (
            <span key={i} className={GAP_HIGHLIGHT[p.tone]}>
              {p.text}
            </span>
          ) : (
            <span key={i}>{p.text}</span>
          ),
        )}
      </div>

      {/* 빈틈 카드 */}
      <div className="mt-4 flex flex-col gap-2.5">
        {gaps.map((g) => {
          const tone = GAP_TONE[g.type];
          const text = GAP_CARD_TEXT[tone];
          return (
            <Card key={g.id} accent={tone}>
              <div className={`text-[13px] font-bold ${text.title}`}>
                {/* core_claim 은 빈틈이 아니라 번호를 붙이지 않는다 */}
                {g.type === "core_claim"
                  ? GAP_LABEL[g.type]
                  : `${String(g.ord).padStart(2, "0")} · ${GAP_LABEL[g.type]}`}
              </div>
              <p className={`mt-1.5 text-sm leading-relaxed ${text.body}`}>
                &ldquo;{g.quote}&rdquo;
                <br />
                {g.reason}
              </p>
            </Card>
          );
        })}
      </div>

      <div className="flex-1" />

      <div className="pt-4">
        {error && (
          <p className="mb-3 text-center text-sm text-coral-text">{error}</p>
        )}
        <Button onClick={onNext} disabled={loading}>
          {loading ? "질문을 만들고 있어…" : "질문 받고 답하기"}
        </Button>
      </div>
    </div>
  );
}
