import { demoLoginEnabled, LoginScreen } from "@/modules/auth";

// 정적으로 굽지 않는다 — 시연 로그인 문은 env 로 여닫으니 요청 때마다 읽어야 한다.
// 프로덕션에서 env 를 넣고 재배포했는데도 빌드 시점 값으로 굳어 카드가 안 떴다.
export const dynamic = "force-dynamic";

export default function Page() {
  // 서버에서만 읽는다 — 심사 기간에만 켜지는 문 (modules/auth/server/demo.ts)
  return <LoginScreen demo={demoLoginEnabled()} />;
}
