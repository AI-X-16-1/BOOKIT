"use client";

import type { ReactNode } from "react";

import type { Partner } from "../partner";
import type { WordQuizResponse } from "../schema";

/** 받침이 있으면 "은", 없으면 "는" — ‘애걸애걸하는’는 이 아니라 ‘애걸애걸하는’은 */
function topic(word: string): string {
  const code = (word.at(-1) ?? "").codePointAt(0) ?? 0;
  if (code < 0xac00 || code > 0xd7a3) return "은(는)";
  return (code - 0xac00) % 28 ? "은" : "는";
}

/**
 * 낱말 퀴즈 한 문제 — 서재에서 읽는 도중에 뜨는 미니게임 (AI #8, 2026-09-19). owner: 강민구
 *
 * 기획 §4-1 의 "어휘 문제 — 책에 나온 단어 뜻 맞히기". 방금 읽은 대목의 낱말 하나를
 * 보기 셋 중에서 고른다. 점수·책갈피·버프는 없다 (spec §2b 불변 — 책갈피는 검증 통과에서만).
 *
 * **맞혀야 계속 읽는다** (강민구 결정, 9/19). 틀린 보기는 흐리게 막고 다시 고르게 한다 —
 * 보기가 셋이라 많아야 두 번 틀리면 답이 남으므로 아이가 갇히지 않는다. 맞히기 전에는
 * 닫는 단추가 없고, 리더는 다음 쪽으로 넘기지 못하게 막는다 (PagedText 의 lockForward).
 *
 * **파트너가 보스를 공격한다** (9/19 강민구 결정 — partner.ts). 맞히면 파트너의 공격이 그 책
 * 보스에게 명중하고, 틀리면 빗나간다. 연출뿐이다 — 보스전 화면·채점·책갈피는 그대로다.
 *
 * 화면은 밝은 카드다. 어두운 판은 "검사받는 중" 표시라 (CLAUDE.md §7) 놀이에는 쓰지 않는다.
 * 768px 이상은 오른쪽 패널에, 미만은 WordQuizSheet 에 담는다 (LibraryScreen).
 */
export function WordQuiz({
  quiz,
  wrong,
  solved,
  onPick,
  onClose,
  partner,
  bossName,
}: {
  quiz: WordQuizResponse;
  /** 같이 싸우는 내 파트너 */
  partner: Partner;
  /** 보스 = 그 책 */
  bossName: string;
  /** 골랐다가 틀린 보기 자리들 */
  wrong: number[];
  /** 정답을 골랐다 */
  solved: boolean;
  onPick: (choice: number) => void;
  onClose: () => void;
}) {
  // 문장 속 그 낱말을 굵게 — 어느 낱말을 묻는지 한눈에 보이게
  const at = quiz.sentence.indexOf(quiz.word);

  return (
    <div>
      <div className="flex min-h-12 items-center justify-between gap-2">
        <span className="rounded-full bg-yellow-bg px-3 py-1 text-xs font-bold text-yellow-text">
          🎮 낱말 퀴즈
        </span>
        {/* 맞히기 전에는 닫을 수 없다 — 맞혀야 계속 읽는다 */}
        {solved && (
          <button
            type="button"
            onClick={onClose}
            className="flex h-12 w-12 items-center justify-center text-[13px] text-faint"
            aria-label="퀴즈 닫기"
          >
            ✕
          </button>
        )}
      </div>

      {/* 파트너 ⚔️ 보스. 맞히면 파트너가 뛰어오르고 보스에 💥, 틀리면 보스가 멀쩡하다 */}
      <div className="mt-2 flex items-center justify-between rounded-card bg-sunken px-4 py-3">
        <div className="flex min-w-0 flex-col items-center">
          <span
            className={`text-[34px] leading-none ${solved ? "motion-safe:animate-bounce" : ""}`}
            aria-hidden
          >
            {partner.face}
          </span>
          <span className="mt-1 max-w-[7rem] truncate text-[11px] font-bold text-ink">
            {partner.name}
          </span>
        </div>
        <span className="text-lg" aria-hidden>
          {solved ? "💥" : wrong.length > 0 ? "💨" : "⚔️"}
        </span>
        <div className="flex min-w-0 flex-col items-center">
          <span className="relative text-[34px] leading-none" aria-hidden>
            📕
            {solved && (
              <span className="absolute -top-2 -right-3 text-xl motion-safe:animate-ping">✨</span>
            )}
          </span>
          <span className="mt-1 max-w-[7rem] truncate text-[11px] font-bold text-coral-deep">
            보스 · {bossName}
          </span>
        </div>
      </div>

      {/* 원문 문장. 따옴표를 씌우지 않는다 — 대화문이면 원문에 이미 “ ” 가 있다 */}
      <p className="mt-2 border-l-4 border-yellow pl-3 text-[15px] leading-relaxed text-ink-soft">
        {at < 0 ? (
          quiz.sentence
        ) : (
          <>
            {quiz.sentence.slice(0, at)}
            <strong className="font-bold text-coral-deep">{quiz.word}</strong>
            {quiz.sentence.slice(at + quiz.word.length)}
          </>
        )}
      </p>
      <p className="mt-3 text-base font-bold text-ink">
        여기서 ‘{quiz.word}’{topic(quiz.word)} 무슨 뜻일까?
      </p>

      <div className="mt-3 flex flex-col gap-2">
        {quiz.choices.map((choice, index) => {
          const missed = wrong.includes(index);
          const tone =
            solved && index === quiz.answer
              ? "border-green bg-green-bg text-green-text"
              : missed
                ? "border-border bg-sunken text-faint line-through"
                : solved
                  ? "border-border bg-card text-faint"
                  : "border-border-strong bg-card text-ink active:opacity-80";
          return (
            <button
              key={index}
              type="button"
              disabled={solved || missed}
              onClick={() => onPick(index)}
              className={`min-h-12 rounded-btn border px-4 py-3 text-left text-[15px] font-medium ${tone}`}
            >
              {choice}
              {solved && index === quiz.answer && <span aria-label="정답"> ✓</span>}
            </button>
          );
        })}
      </div>

      {!solved && wrong.length > 0 && (
        <p className="mt-3 text-[15px] leading-relaxed text-coral-text" aria-live="polite">
          {partner.name}의 공격이 빗나갔어! 위 문장을 한 번 더 읽고 다른 뜻을 골라 볼래?
        </p>
      )}
      {solved && (
        <>
          <p className="mt-3 text-[15px] leading-relaxed text-ink" aria-live="polite">
            {wrong.length === 0
              ? `맞았어! ${partner.name}의 공격이 보스에게 명중했어 💥`
              : `찾았다! ${partner.name}의 공격이 명중했어 💥 초록 칸이 이 문장에서의 뜻이야.`}
          </p>
          <button
            type="button"
            onClick={onClose}
            className="mt-3 min-h-12 w-full rounded-btn bg-ink px-5 text-[15px] font-bold text-on-dark"
          >
            계속 읽기
          </button>
        </>
      )}
    </div>
  );
}

/**
 * 768px 미만 — 퀴즈를 담는 시트. 공용 BottomSheet 는 ✕ 와 바깥 누르기로 늘 닫혀서
 * "맞혀야 계속 읽는다" 를 지킬 수 없다 (src/shared 는 김민경 소관이라 옵션을 더하지 않는다).
 * 모양은 BottomSheet 와 같게 — 26px 윗모서리, 핸들, 크림 바탕
 */
export function WordQuizSheet({ children }: { children: ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end">
      <div className="absolute inset-0 bg-ink/45" aria-hidden />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="낱말 퀴즈"
        className="relative max-h-[88vh] overflow-y-auto rounded-t-sheet bg-cream px-6 pt-7 pb-[34px]"
      >
        <div className="mx-auto mb-[22px] h-[5px] w-11 rounded-full bg-sheet-handle" />
        {children}
      </div>
    </div>
  );
}
