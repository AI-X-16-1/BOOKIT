/**
 * 조건부 className 결합. 의존성 없이 쓰려고 만든 최소 구현이다.
 *
 * 주의: Tailwind 클래스 충돌을 병합하지 않는다 (tailwind-merge 아님).
 * 같은 속성을 덮어써야 하면 className 으로 겹치지 말고,
 * 컴포넌트가 노출한 prop(variant, tone, fullWidth 등)을 쓸 것.
 */
export function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}
