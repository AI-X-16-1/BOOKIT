"use client";

import { useState } from "react";
import type { GuardianLinkResponse } from "@/shared/types";
import { apiPost } from "@/shared/api/client";
import { Button, Card } from "@/shared/ui";

/**
 * '나' 화면에 붙는 보호자 공유 카드 (#81).
 *
 * POST /api/guardian/link 는 학생당 활성 링크가 하나라 몇 번을 눌러도
 * 항상 같은 주소를 돌려준다 (guardian/server/link.ts) — 그래서 재발급 버튼은
 * 따로 두지 않는다. "이미 발급된 링크가 있으면 그걸 보여주기"는 같은 버튼을
 * 다시 눌러도 저절로 된다.
 */
export function GuardianShareCard() {
  const [url, setUrl] = useState<string | null>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "error" | "copied">(
    "idle",
  );

  const handleShow = async () => {
    setStatus("loading");
    try {
      const data = await apiPost<GuardianLinkResponse>("/api/guardian/link", {});
      setUrl(data.url);
      setStatus("idle");
    } catch {
      setStatus("error");
    }
  };

  const handleCopy = async () => {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setStatus("copied");
    } catch {
      setStatus("error");
    }
  };

  return (
    <Card>
      <div className="text-[13px] text-muted">보호자 공유</div>
      <p className="mt-2 text-sm leading-relaxed text-ink">
        완독·책갈피·이해도 점수만 보여주는 링크야. 독후감 내용은 보이지 않아.
      </p>

      {url ? (
        <div className="mt-3 flex flex-col gap-2">
          <div className="truncate rounded-btn border border-border-soft bg-cream px-3.5 py-2.5 text-sm text-ink">
            {url}
          </div>
          <Button variant="outline" onClick={handleCopy}>
            {status === "copied" ? "복사했어!" : "링크 복사하기"}
          </Button>
        </div>
      ) : (
        <Button
          className="mt-3"
          variant="outline"
          onClick={handleShow}
          disabled={status === "loading"}
        >
          {status === "loading" ? "만드는 중…" : "보호자에게 보여주기"}
        </Button>
      )}

      {status === "error" && (
        <p className="mt-2 text-center text-[13px] text-coral">
          링크를 만들지 못했어. 다시 해볼까?
        </p>
      )}
    </Card>
  );
}
