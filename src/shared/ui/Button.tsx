import type { ButtonHTMLAttributes } from "react";
import { cn } from "./cn";

/**
 * 목업의 CTA 버튼.
 * 공통: radius 14px, padding 19px, 17px/700, 최소 높이 48px (docs/design-tokens.md "Spacing & sizing").
 *
 * 초록은 primary 로 쓰지 않는다 — 이 앱에서 초록은 "무료 열람"을 뜻한다
 * (docs/design-tokens.md "Color roles").
 */
export type ButtonVariant = "primary" | "dark" | "outline" | "quiet";

const VARIANT: Record<ButtonVariant, string> = {
  // 주 동작. 목업 2 L87, L126
  primary: "bg-coral text-white",
  // 외부 이동·보조 강조. 목업 2 L55, 목업 4 L82
  dark: "bg-ink text-on-dark",
  // 나란히 놓이는 두 번째 선택지. 목업 4 L84
  outline: "bg-card text-ink border border-border-strong",
  // "그냥 책잇에 남아있을래요" 류의 빠져나가기. 목업 2 L57
  quiet: "bg-transparent text-faint font-normal",
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  /** 목업의 CTA는 전부 화면 폭을 채운다. 나란히 놓을 때만 false. */
  fullWidth?: boolean;
}

export function Button({
  variant = "primary",
  fullWidth = true,
  className,
  type = "button",
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={cn(
        "min-h-12 rounded-btn px-5 py-[19px] text-center text-[17px] font-bold",
        "transition-opacity active:opacity-80 disabled:cursor-not-allowed disabled:opacity-45",
        VARIANT[variant],
        fullWidth && "w-full",
        className,
      )}
      {...props}
    />
  );
}
