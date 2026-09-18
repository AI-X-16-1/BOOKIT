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
      className={`flex min-h-12 items-center justify-between gap-3 rounded-card border border-border-soft bg-card px-5 py-4 ${className ?? ""}`}
    >
      <span className="min-w-0">
        <span className="block text-sm font-bold text-ink">읽기 수준 알아보기</span>
        <span className="mt-[3px] block text-xs text-muted">
          짧은 글 하나로 나한테 맞는 책 난이도를 찾아줘
        </span>
      </span>
      <span aria-hidden className="flex-none text-[18px] text-coral">
        →
      </span>
    </Link>
  );
}
