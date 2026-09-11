import type { MetadataRoute } from "next";

/**
 * PWA 매니페스트 — /manifest.webmanifest 로 나간다.
 *
 * 소유: 김민경 (CLAUDE.md §3 auth·PWA).
 *
 * 아이들이 홈 화면에 두고 쓰는 게 기본 사용 방식이라 standalone 으로 연다.
 * 색은 docs/design-tokens.md 의 bg-cream 그대로 — 스플래시와 앱 배경이 이어져 보인다.
 * 아이콘은 scripts/generate-icons.mjs 가 만든다 (`npm run icons`).
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "책잇",
    short_name: "책잇",
    description: "읽고 쓰고, 진짜 이해했는지 확인받는 독서 서비스",
    lang: "ko",
    start_url: "/",
    scope: "/",
    display: "standalone",
    // 학생 화면은 430px 기준 세로 화면이다 (CLAUDE.md §8)
    orientation: "portrait",
    background_color: "#FDF6EC",
    theme_color: "#FDF6EC",
    categories: ["education", "books"],
    icons: [
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      // 안드로이드는 아이콘을 원형 등으로 잘라낸다. 여백이 큰 별도 파일을 준다
      {
        src: "/icons/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
