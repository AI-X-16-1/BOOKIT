"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";

import { createClient } from "@/shared/supabase/client";

/**
 * 로그인. 목업 1 #1 (docs/mockups/1 온보딩·로그인.dc.html L35-53).
 * 공책 배경은 로그인·결과 화면에만 쓴다 (CLAUDE.md §7).
 *
 * 구글 하나만 쓴다 (CLAUDE.md §1). 버튼을 누르면 구글로 갔다가
 * /auth/callback 으로 돌아오고, 거기서 세션 쿠키가 심어진다.
 */
function LoginCard() {
  const searchParams = useSearchParams();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(
    searchParams.get("error") ? "로그인이 끝나지 않았어. 한 번만 더 해볼까?" : null,
  );

  const signIn = async () => {
    setBusy(true);
    setError(null);

    const supabase = createClient();
    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        // 콜백은 현재 접속한 주소 기준이어야 한다. 로컬과 배포가 같은 코드로 돈다
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    // 성공하면 이 줄에 닿기 전에 구글로 떠난다
    if (oauthError) {
      console.error("[login] 구글 로그인 시작 실패", oauthError);
      setError("지금은 로그인이 안 돼. 잠시 뒤에 다시 해볼까?");
      setBusy(false);
    }
  };

  return (
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
        onClick={signIn}
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

      {error && (
        <p className="mt-4 text-center text-[13px] font-bold text-coral">
          {error}
        </p>
      )}

      <p className="mt-5 text-center text-sm leading-relaxed text-faint">
        만 13세 미만은 구글 보호자 인증을
        <br />
        거쳐요 ✎
      </p>
    </div>
  );
}

export function LoginScreen() {
  return (
    <div className="relative flex min-h-dvh items-center justify-center bg-notebook px-6">
      {/* 형광펜 자국과 별 — 목업 L37-40 */}
      <div className="absolute top-[120px] left-11 h-[22px] w-24 -rotate-5 bg-yellow" />
      <div className="absolute right-[46px] bottom-[150px] h-6 w-[104px] -rotate-5 bg-blue" />
      <span className="absolute top-[190px] right-16 text-[22px] text-coral">
        ★
      </span>
      <span className="absolute bottom-[230px] left-14 text-xl text-green">
        ★
      </span>

      {/* useSearchParams 는 Suspense 경계가 필요하다 */}
      <Suspense>
        <LoginCard />
      </Suspense>
    </div>
  );
}
