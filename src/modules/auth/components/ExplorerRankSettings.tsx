"use client";

import { useEffect, useState } from "react";

import { ApiClientError, apiGet, apiPatch } from "@/shared/api/client";
import type { ExplorerRank, MeResponse, UpdateProfileResponse } from "@/shared/types";

import { ExplorerRankPicker } from "./ExplorerRankPicker";

/**
 * '나' 화면에서 탐험가 등급을 바꾼다 — 목업 7 #8 "등급은 나중에 프로필에서 바꿀 수 있어요".
 *
 * 소유: 김민경 (CLAUDE.md §3). '나' 화면(rewards)이 이 컴포넌트를 한 줄로 얹는다.
 * 고르면 바로 PATCH /api/profile 로 저장한다 — 저장 버튼이 따로 없다.
 */
export function ExplorerRankSettings({ className }: { className?: string }) {
  const [rank, setRank] = useState<ExplorerRank | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  useEffect(() => {
    apiGet<MeResponse>("/api/profile")
      .then((me) => setRank(me.explorer_rank))
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, []);

  const change = async (next: ExplorerRank | null) => {
    const previous = rank;
    setRank(next);
    setBusy(true);
    setNote(null);
    try {
      await apiPatch<UpdateProfileResponse>("/api/profile", { explorer_rank: next });
      setNote(next ? `이제 ${next} 탐험가야!` : "등급을 비워 뒀어.");
    } catch (cause) {
      setRank(previous);
      setNote(
        cause instanceof ApiClientError ? cause.message : "잠깐 문제가 생겼어. 다시 해볼까?",
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={className}>
      <div className="text-[13px] text-muted">탐험가 등급</div>
      <div className="mt-3">
        <ExplorerRankPicker value={rank} onChange={change} disabled={!loaded || busy} />
      </div>
      {note && <p className="mt-2 text-[13px] text-muted">{note}</p>}
    </div>
  );
}
