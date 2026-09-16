import type { Metadata } from "next";

import { LegalPage } from "@/modules/auth";

export const metadata: Metadata = { title: "이용약관 · 책잇" };

export default function Page() {
  return <LegalPage kind="terms" />;
}
