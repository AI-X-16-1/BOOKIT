"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

/**
 * 로그인. 목업 1 #1 (docs/mockups/1 온보딩·로그인.dc.html L35-53).
 * 공책 배경은 로그인·결과 화면에만 쓴다 (CLAUDE.md §7).
 *
 * ⚠️ 실제 Google OAuth 는 붙어 있지 않다. 버튼을 누르면 온보딩으로 넘어갈 뿐이다.
 */
export function LoginScreen() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  return (
    <div className="relative flex min-h-dvh items-center justify-center bg-notebook px-6">
      {/* 형광펜 자국과 별 — 목업 L37-40 */}
      <div className="absolute top-[120px] left-11 h-[22px] w-24 -rotate-5 bg-yellow" />
      <div className="absolute right-[46px] bottom-[150px] h-6 w-[104px] -rotate-5 bg-blue" />
      <span className="absolute top-[190px] right-16 text-[22px] text-coral">★</span>
      <span className="absolute bottom-[230px] left-14 text-xl text-green">★</span>

      <div className="relative flex w-full max-w-[382px] flex-col items-center rounded-sheet bg-card px-8 py-12 shadow-card">
        <div className="flex h-[72px] w-[72px] items-center justify-center rounded-[20px] bg-ink text-3xl font-bold text-on-dark">
          ▯▯
        </div>
        <h1 className="mt-5 text-[34px] font-bold text-ink">책잇</h1>
        <p className="mt-2.5 text-center text-base leading-relaxed text-muted">
          네가 진짜 읽었는지,
          <br />
          밑줄로 증명해봐
        </p>

        <button
          type="button"
          disabled={busy}
          onClick={() => {
            setBusy(true);
            router.push("/onboarding");
          }}
          className="mt-9 flex min-h-12 w-full items-center justify-center gap-2.5 rounded-card border border-border bg-white p-[18px] disabled:opacity-60"
        >
          <span
            aria-hidden
            className="h-[22px] w-[22px] rounded-full"
            style={{
              background:
                "conic-gradient(#ea4335 0 25%,#fbbc05 0 50%,#34a853 0 75%,#4285f4 0)",
            }}
          />
          <span className="text-[17px] font-bold text-ink-soft">
            {busy ? "이동 중…" : "Google로 시작하기"}
          </span>
        </button>

        <p className="mt-5 text-center text-sm leading-relaxed text-faint">
          만 13세 미만은 구글 보호자 인증을
          <br />
          거쳐요 ✎
        </p>
      </div>
    </div>
  );
}
