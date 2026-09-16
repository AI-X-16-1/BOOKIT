import type { Metadata } from "next";

import { LegalPage } from "@/modules/auth";

export const metadata: Metadata = { title: "개인정보처리방침 · 책잇" };

export default function Page() {
  return <LegalPage kind="privacy" />;
}
