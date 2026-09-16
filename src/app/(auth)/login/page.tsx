import { demoLoginEnabled, LoginScreen } from "@/modules/auth";

export default function Page() {
  // 서버에서만 읽는다 — 심사 기간에만 켜지는 문 (modules/auth/server/demo.ts)
  return <LoginScreen demo={demoLoginEnabled()} />;
}
