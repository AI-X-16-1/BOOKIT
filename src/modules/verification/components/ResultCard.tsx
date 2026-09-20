"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { faceOf } from "@/modules/reader";
import { apiGet } from "@/shared/api/client";
import type { AnswerResponse, CharactersResponse, CharacterView } from "@/shared/types";
import { Button } from "@/shared/ui";
import { HIT_LABEL, STYLE_HIT_LABEL } from "./labels";

/**
 * 채점 결과. 저학년 개편 — 목업 10 M07 (2026-09-20).
 *
 * 밝은 공책 배경 위에: ✓ 큰 동그라미 + "진짜로 이해했구나!" → 책갈피 +N 카드 →
 * "친구가 다 자랐어!" 진화 카드 → 다음 책 고르기 / 도감 보러 가기.
 * 실패는 목업에 없어서 같은 틀로 "조금만 더!" 톤이다 — 벌처럼 보이지 않게, 무엇을
 * 더하면 되는지 말하고 재시도를 준다 (CLAUDE.md §9).
 *
 * **채점 로직·점수·책갈피는 그대로고 보이는 것만 바뀐다** (docs/sprint-0918.md 불변식).
 * 서버 응답(AnswerResponse)을 새로 해석하지 않는다. 진화 카드의 얼굴은 /api/characters
 * 의 stage 를 그대로 읽는다 — 클라이언트가 단계를 계산하지 않는다 (README-kids-redesign).
 *
 * 보스전 보라 3색(--boss-*)은 이 개편에서 쓰지 않는다. 검증 "질문" 화면(QuestionPanel)은
 * 여전히 어둡다 — 그게 "지금 확인받는 중" 신호다 (CLAUDE.md §7). 결과는 축하 화면이라 밝다.
 */
export interface ResultCardProps {
  bookTitle: string;
  result: AnswerResponse;
  streakDays: number;
  onRetry: () => void;
  onDone: () => void;
  retrying?: boolean;
  /** 재시도 질문을 못 받아 왔을 때. 아이가 그대로 읽는 문장이다 */
  error?: string | null;
}

/** 축 한 칸 — 때린 축은 초록, 못 때린 축은 코랄 */
function Axis({ name, value, hit }: { name: string; value: string; hit: boolean }) {
  return (
    <div className={`rounded-[14px] px-2 py-2.5 text-center ${hit ? "bg-green-bg" : "bg-coral-bg"}`}>
      <div className={`text-[13px] font-medium ${hit ? "text-green-ink" : "text-coral-ink"}`}>{name}</div>
      <div className={`mt-0.5 font-display text-[17px] ${hit ? "text-green-ink" : "text-coral-ink"}`}>
        {hit ? "✓ " : ""}
        {value}
      </div>
    </div>
  );
}

export function ResultCard({
  bookTitle,
  result,
  streakDays,
  onRetry,
  onDone,
  retrying = false,
  error = null,
}: ResultCardProps) {
  const { passed, scores, feedback, points } = result;
  const [character, setCharacter] = useState<CharacterView | null>(null);
  const [balance, setBalance] = useState<number | null>(null);

  useEffect(() => {
    if (!passed) return;
    apiGet<CharactersResponse>("/api/characters")
      .then((r) => setCharacter(r.characters.find((c) => c.book_title === bookTitle) ?? null))
      .catch(() => {});
    apiGet<{ balance: number }>("/api/points")
      .then((r) => setBalance(r.balance))
      .catch(() => {});
  }, [passed, bookTitle]);

  const grownFace = character
    ? faceOf(character.stage as 0 | 1 | 2, character.art_seed, character.book_id)
    : "🐦";

  return (
    // 아래 여백 100px: 이 화면은 -mt 로 main 의 위 여백을 지우고 화면을 꽉 채운다. 그 바닥을
    // 하단 탭바(92px, 고정)가 덮으므로 버튼이 탭바 뒤로 들어가지 않게 둔다 (md 에서는 원래대로)
    <div className="-mx-[22px] -mt-[44px] flex min-h-dvh flex-col bg-notebook px-[22px] pt-[52px] pb-[calc(100px+env(safe-area-inset-bottom))] md:mx-0 md:mt-0 md:min-h-0 md:flex-1 md:rounded-card md:pt-8 md:pb-[26px]">
      {passed && (
        <>
          <span aria-hidden className="pointer-events-none absolute top-[150px] left-10 text-[20px] animate-[bookit-twinkle_2s_ease-in-out_infinite]">✨</span>
          <span aria-hidden className="pointer-events-none absolute top-[120px] right-[46px] text-[17px] animate-[bookit-twinkle_2s_ease-in-out_.6s_infinite]">✨</span>
        </>
      )}

      {/* 머리 — ✓ 큰 동그라미 + 한 줄 */}
      <div className="flex flex-col items-center gap-3 animate-[bookit-pop_.6s_cubic-bezier(.22,1.4,.4,1)_both]">
        <span
          aria-hidden
          className={`flex h-[78px] w-[78px] items-center justify-center rounded-full text-[40px] ${
            passed ? "bg-green text-white shadow-[0_10px_22px_rgba(63,167,120,.35)]" : "bg-coral-bg-2 text-coral-ink"
          }`}
        >
          {passed ? "✓" : "💪"}
        </span>
        <h1 className="text-center text-[34px] leading-tight text-ink">
          {passed ? "진짜로 이해했구나!" : "조금만 더!"}
        </h1>
      </div>
      <p className="mt-1.5 text-center text-[17px] font-medium text-muted">
        {passed ? `${bookTitle} · 독후감 통과` : `${bookTitle} · 한 번 더 답해볼까?`}
      </p>

      {/* 책갈피 — 통과했을 때만. 실패는 0점을 강조하지 않는다 */}
      {passed && (
        <div className="relative mt-5 flex items-center gap-4 overflow-hidden rounded-[26px] border-[3px] border-border bg-card p-[18px]">
          <span aria-hidden className="pointer-events-none absolute top-4 left-16 font-display text-[20px] text-yellow-deep animate-[bookit-rise_2.6s_ease-out_infinite]">
            +{points}
          </span>
          <span aria-hidden className="flex h-[78px] w-[78px] flex-none items-center justify-center rounded-full bg-yellow-bg text-[38px] animate-[bookit-bob-s_3s_ease-in-out_infinite]">
            🔖
          </span>
          <div>
            <div className="font-display text-[34px] leading-none text-yellow-text">+{points}</div>
            <div className="mt-1.5 text-[16px] font-medium text-muted">
              책갈피를 받았어{balance !== null ? ` · 이제 ${balance.toLocaleString()}개` : ""}
            </div>
          </div>
        </div>
      )}

      {/* 진화 — 통과했을 때만 */}
      {passed && (
        <div className="mt-3.5 flex flex-col items-center gap-2.5 rounded-[26px] border-[3px] border-coral-border bg-coral-bg p-5">
          <div className="font-display text-[20px] text-coral-ink">친구가 다 자랐어!</div>
          <div className="flex items-center gap-3">
            <span aria-hidden className="flex h-[70px] w-[70px] items-center justify-center rounded-full bg-coral-bg-2 text-[34px] opacity-50">🐣</span>
            <span aria-hidden className="text-[24px] text-coral-light">→</span>
            <span
              aria-hidden
              className="relative flex h-[104px] w-[104px] items-center justify-center rounded-full text-[54px] animate-[bookit-bob_3.6s_ease-in-out_infinite]"
              style={{ background: "radial-gradient(circle at 50% 35%, #FFE3D9, #FFCDBD)" }}
            >
              <span className="absolute inset-0 rounded-full border-[3px] border-coral-light animate-[bookit-ring_2.2s_ease-out_infinite]" />
              {grownFace}
            </span>
          </div>
          <div className="font-display text-[22px] text-ink">{character?.stage_name ?? `${bookTitle} 친구`}</div>
          {streakDays > 0 && (
            <div className="text-[16px] font-medium text-coral-muted">🔥 {streakDays}일째 연속으로 해냈어</div>
          )}
        </div>
      )}

      {/* AI 피드백 — 문장은 서버가 준 그대로다 */}
      <div className={`mt-3.5 rounded-[26px] border-[3px] p-[18px] ${passed ? "border-border bg-card" : "border-yellow bg-yellow-bg"}`}>
        <div className="flex items-center gap-2.5">
          <span aria-hidden className="flex h-11 w-11 flex-none items-center justify-center rounded-full bg-coral-bg-2 text-[22px]">🐦</span>
          <span className="font-display text-[20px] text-ink">{passed ? "제일 좋았던 문장" : "이걸 더 써주면 돼"}</span>
        </div>
        <p className="mt-2.5 text-[17px] leading-[1.7] text-ink-soft">{feedback}</p>
        <div className="mt-3 grid grid-cols-3 gap-2">
          <Axis name="이유" value={HIT_LABEL[scores.logic_consistency]} hit={scores.logic_consistency === "pass"} />
          <Axis name="자세히" value={HIT_LABEL[scores.specificity]} hit={scores.specificity === "pass"} />
          <Axis name="내 말투" value={STYLE_HIT_LABEL[scores.style_consistency]} hit={scores.style_consistency === "same"} />
        </div>
      </div>

      {error && <p className="mt-3 text-center text-[16px] font-bold text-coral">{error}</p>}

      <div className="flex-1" />

      <div className="mt-5 flex flex-col gap-2.5">
        {passed ? (
          <>
            <Link
              href="/library"
              className="flex min-h-[70px] items-center justify-center rounded-btn bg-coral px-5 text-center font-display text-[25px] text-white shadow-[var(--shadow-press)] active:translate-y-[4px] active:shadow-none"
            >
              다음 책 고르기 →
            </Link>
            <Link
              href="/collection"
              className="flex min-h-[62px] items-center justify-center rounded-btn border-[3px] border-border bg-card px-5 text-center font-display text-[21px] text-ink-mid"
            >
              🥚 도감 보러 가기
            </Link>
          </>
        ) : (
          <>
            <p className="text-center text-[15px] font-medium text-muted">다시 하면 새 질문이 나와. 책갈피는 통과하면 받아</p>
            <Button onClick={onRetry} disabled={retrying}>
              {retrying ? "새 질문을 만들고 있어…" : "다시 답해볼래! →"}
            </Button>
            <Button variant="outline" onClick={onDone} className="min-h-[62px] text-[21px]">
              나중에 할래
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
