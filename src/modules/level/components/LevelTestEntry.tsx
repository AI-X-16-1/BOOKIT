import Link from "next/link";

/**
 * '나' 화면의 레벨테스트 진입로. owner: 박재경
 *
 * 온보딩에 단계를 넣는 것은 auth 소유자와 함께 해야 해서 아직 안 했다 (plan-ko §14-2).
 * 그때까지 이 줄이 유일한 진입로다 — **데모 로그인은 온보딩을 건너뛰므로**
 * 심사자도 여기로만 들어온다.
 *
 * 서버 컴포넌트다. 누르면 이동만 하므로 상태가 필요 없다.
 */
export function LevelTestEntry({ className }: { className?: string }) {
  return (
    <Link
      href="/level-test"
      className={`flex min-h-14 items-center gap-3.5 rounded-card border-[3px] border-border bg-card px-[18px] py-4 ${className ?? ""}`}
    >
      <span aria-hidden className="flex h-12 w-12 flex-none items-center justify-center rounded-full bg-blue-bg text-[24px]">📖</span>
      <span className="min-w-0 flex-1">
        <span className="block font-display text-[20px] text-ink">읽기 수준 알아보기</span>
        <span className="block text-[15px] font-medium text-muted">
          짧은 글 하나로 나한테 맞는 책을 찾아줘
        </span>
      </span>
      <span aria-hidden className="flex-none text-[22px] text-coral">
        →
      </span>
    </Link>
  );
}
