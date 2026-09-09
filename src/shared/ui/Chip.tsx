import type { HTMLAttributes } from "react";
import { cn } from "./cn";

/**
 * 알약 배지. 목업 2 L44(무료 열람 가능), L104(3곳).
 *
 * 톤에 의미가 붙어 있다 (docs/design-tokens.md "Color roles"):
 *   green  = 무료 열람 / 통과
 *   yellow = 책갈피 · 스트릭 · 완독
 *   blue   = 새 장르 · 정보성 카운트
 *   coral  = 강조
 * 색을 장식으로 고르지 말 것.
 */
export type ChipTone = "coral" | "yellow" | "green" | "blue" | "neutral" | "dark";

const TONE: Record<ChipTone, string> = {
  coral: "bg-coral text-white",
  yellow: "bg-yellow-bg text-yellow-text",
  green: "bg-green-bg text-green-text",
  blue: "bg-blue-bg text-blue-text",
  neutral: "bg-sunken text-muted",
  dark: "bg-panel text-on-dark",
};

export interface ChipProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: ChipTone;
}

export function Chip({ tone = "neutral", className, ...props }: ChipProps) {
  return (
    <span
      className={cn(
        "inline-block rounded-full px-3 py-1.5 text-xs font-bold whitespace-nowrap",
        TONE[tone],
        className,
      )}
      {...props}
    />
  );
}
