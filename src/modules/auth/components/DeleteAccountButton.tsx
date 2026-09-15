"use client";

/**
 * 탈퇴 버튼. 한 번 누르면 확인 문구가 펼쳐지고, 한 번 더 눌러야 지운다.
 * 브라우저 confirm() 대신 화면 안에서 묻는다 — 목업 톤(반말, 짧게)을 지키려고.
 *
 * 소유: 김민경 (CLAUDE.md §3).
 */

import { useRouter } from "next/navigation";
import { useState } from "react";

import { ApiClientError, apiDelete } from "@/shared/api/client";
import type { DeleteProfileResponse } from "@/shared/types";
import { Button } from "@/shared/ui";

export function DeleteAccountButton({
  warning = "독후감과 책갈피가 모두 지워져.",
  className,
}: {
  /** 역할별로 무엇이 지워지는지. 교사는 반과 참여 코드까지 */
  warning?: string;
  className?: string;
}) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const remove = async () => {
    setBusy(true);
    setError(null);
    try {
      await apiDelete<DeleteProfileResponse>("/api/profile");
      // 서버가 세션 쿠키를 지웠다. 로그인 화면으로
      router.replace("/login");
      router.refresh();
    } catch (cause) {
      setError(
        cause instanceof ApiClientError ? cause.message : "잠깐 문제가 생겼어. 다시 해볼까?",
      );
      setBusy(false);
    }
  };

  if (!confirming) {
    return (
      <div className={className}>
        <Button type="button" variant="quiet" onClick={() => setConfirming(true)}>
          탈퇴하기
        </Button>
      </div>
    );
  }

  return (
    <div className={className}>
      <div className="rounded-card bg-coral-bg p-4 text-center">
        <p className="text-[15px] font-bold text-ink">정말 떠날 거야?</p>
        <p className="mt-1 text-[14px] text-muted">{warning}</p>
        {error && <p className="mt-2 text-[14px] font-bold text-coral">{error}</p>}
        <div className="mt-3 flex justify-center gap-2">
          <Button type="button" variant="outline" onClick={() => setConfirming(false)} disabled={busy}>
            남을래
          </Button>
          <Button type="button" variant="primary" onClick={remove} disabled={busy}>
            {busy ? "지우는 중…" : "지울래"}
          </Button>
        </div>
      </div>
    </div>
  );
}
