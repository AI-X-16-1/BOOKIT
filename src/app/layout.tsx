import type { Metadata, Viewport } from "next";
import { Noto_Sans_KR } from "next/font/google";

import { RegisterServiceWorker } from "@/shared/pwa";
import "./globals.css";

const notoSansKr = Noto_Sans_KR({
  variable: "--font-noto-sans-kr",
  subsets: ["latin"],
  weight: ["400", "500", "700", "900"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "책잇",
  description: "읽고 쓰고, 진짜 이해했는지 확인받는 독서 서비스",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: "/icons/icon-192.png",
    apple: "/icons/apple-touch-icon.png",
  },
  // iOS 는 매니페스트를 거의 안 읽는다. 홈 화면 앱으로 열리게 따로 알려준다
  appleWebApp: {
    capable: true,
    title: "책잇",
    statusBarStyle: "default",
  },
};

export const viewport: Viewport = {
  themeColor: "#FDF6EC",
  // 모바일 우선 430px 기준 (CLAUDE.md §8)
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ko" className={`${notoSansKr.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">
        {children}
        <RegisterServiceWorker />
      </body>
    </html>
  );
}
