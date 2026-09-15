"use client";

import { useEffect } from "react";

/**
 * 서비스 워커 등록. 루트 레이아웃에 한 번만 넣는다.
 *
 * 소유: 김민경 (CLAUDE.md §3 auth·PWA).
 *
 * 개발 중에는 등록하지 않는다 — 캐시가 남아 방금 고친 화면이 안 나오는 사고가
 * 개발 서버에서 제일 흔하다. 설치 배너도 프로덕션에서만 확인하면 된다.
 */
export function RegisterServiceWorker() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (!("serviceWorker" in navigator)) return;

    const register = () => {
      navigator.serviceWorker.register("/sw.js").catch((cause: unknown) => {
        console.error("[pwa] 서비스 워커 등록 실패", cause);
      });
    };

    // 첫 화면 렌더와 경쟁하지 않게 로드 후로 미룬다
    if (document.readyState === "complete") {
      register();
      return;
    }
    window.addEventListener("load", register);
    return () => window.removeEventListener("load", register);
  }, []);

  return null;
}
