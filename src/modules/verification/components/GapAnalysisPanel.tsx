"use client";

import type { ReviewGapView } from "@/shared/types";
import { Button, Card, Chip } from "@/shared/ui";
import { GAP_LABEL, GAP_TONE } from "./labels";

/**
 * 빈틈 분석 결과. 목업 2 #3 (docs/mockups/2 독후감 작성.dc.html L97-127).
 *
 * 독후감 본문에서 지적된 문장을 그대로 하이라이트한다.
 * 코랄 = 근거 없이 단정, 옐로 = 나머지.
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

/** 본문에서 각 빈틈 인용문을 찾아 하이라이트한 조각으로 쪼갠다. */
function highlight(body: string, gaps: ReviewGapView[]) {
  const parts: Array<{ text: string; tone?: "coral" | "yellow" }> = [];
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
        <Chip tone="blue">{gaps.length}곳</Chip>
      </div>

      {/* 본문 + 하이라이트 */}
      <div className="mt-4 rounded-[14px] border border-border-soft bg-card p-[18px] text-[15px] leading-[2] text-ink-soft">
        {parts.map((p, i) =>
          p.tone === "coral" ? (
            <span key={i} className="border-b-2 border-b-coral bg-coral-bg-2">
              {p.text}
            </span>
          ) : p.tone === "yellow" ? (
            <span key={i} className="border-b-2 border-b-yellow bg-yellow-bg">
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
          return (
            <Card key={g.id} accent={tone}>
              <div
                className={`text-[13px] font-bold ${tone === "coral" ? "text-coral-text" : "text-yellow-text"}`}
              >
                {String(g.ord).padStart(2, "0")} · {GAP_LABEL[g.type]}
              </div>
              <p
                className={`mt-1.5 text-sm leading-relaxed ${tone === "coral" ? "text-coral-text-2" : "text-yellow-text-2"}`}
              >
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
