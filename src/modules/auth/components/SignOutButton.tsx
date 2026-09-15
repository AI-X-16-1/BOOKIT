/**
 * 로그아웃 버튼. 서버 컴포넌트에서도 쓸 수 있게 JS 없이 form 으로 보낸다.
 *
 * 소유: 김민경 (CLAUDE.md §3).
 */

import { Button } from "@/shared/ui";

export function SignOutButton({ className }: { className?: string }) {
  return (
    <form method="post" action="/auth/signout" className={className}>
      <Button type="submit" variant="quiet">
        로그아웃
      </Button>
    </form>
  );
}
