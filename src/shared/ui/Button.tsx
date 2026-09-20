import type { ButtonHTMLAttributes } from "react";
import { cn } from "./cn";

/**
 * 목업의 CTA 버튼.
 * 저학년 개편(목업 10, 2026-09-20): 높이 70px(태블릿 86px), radius 22px, Jua 24px,
 * 코랄은 아래에 눌리는 면(--shadow-press). 이전: 48px / 14px / 17px 700.
 *
 * 초록은 primary 로 쓰지 않는다 — 이 앱에서 초록은 "무료 열람"을 뜻한다
 * (docs/design-tokens.md "Color roles").
 */
export type ButtonVariant = "primary" | "dark" | "outline" | "quiet";

const VARIANT: Record<ButtonVariant, string> = {
  // 주 동작. 목업 2 L87, L126
  primary: "bg-coral text-white shadow-[var(--shadow-press)] active:translate-y-[4px] active:shadow-none",
  // 외부 이동·보조 강조. 목업 2 L55, 목업 4 L82
  dark: "bg-ink text-on-dark",
  // 나란히 놓이는 두 번째 선택지. 목업 4 L84
  outline: "bg-card text-ink-mid border-[3px] border-border",
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
        "flex min-h-[70px] items-center justify-center gap-2 rounded-btn px-5 text-center font-display text-[24px] md:min-h-[86px] md:text-[26px]",
        "transition-[opacity,transform,box-shadow] disabled:cursor-not-allowed disabled:opacity-45",
        VARIANT[variant],
        fullWidth && "w-full",
        className,
      )}
      {...props}
    />
  );
}
