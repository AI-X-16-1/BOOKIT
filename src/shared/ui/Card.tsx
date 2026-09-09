import type { HTMLAttributes } from "react";
import { cn } from "./cn";

/**
 * 기본 카드는 크림 배경 위의 흰 종이다.
 *
 * accent 를 주면 목업의 빈틈 콜아웃 형태가 된다 — 왼쪽 3px 굵은 선 + 톤 배경.
 * 목업 2 L111-123 (근거 없이 단정 / 뭉뚱그린 문장 / 감상만 남음).
 */
export type CardAccent = "coral" | "yellow" | "green" | "blue";

const ACCENT: Record<CardAccent, string> = {
  coral: "bg-coral-bg border-l-[3px] border-l-coral",
  yellow: "bg-yellow-bg border-l-[3px] border-l-yellow",
  green: "bg-green-bg border-l-[3px] border-l-green",
  blue: "bg-blue-bg border-l-[3px] border-l-blue",
};

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  accent?: CardAccent;
  /** 목업 홈 화면처럼 카드를 띄워야 할 때. 기본은 그림자 없음. */
  raised?: boolean;
}

export function Card({
  accent,
  raised = false,
  className,
  ...props
}: CardProps) {
  return (
    <div
      className={cn(
        "rounded-card p-[18px]",
        accent ? ACCENT[accent] : "bg-card border border-border-soft",
        raised && "shadow-card",
        className,
      )}
      {...props}
    />
  );
}
