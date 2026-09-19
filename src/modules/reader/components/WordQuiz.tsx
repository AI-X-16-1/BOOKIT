"use client";

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
 * 보기 셋 중에서 고른다. 탭 한 번이면 끝나고, 맞든 틀리든 뜻을 보여준 뒤 계속 읽는다.
 * 점수·책갈피·버프는 없다 (spec §2b 불변 — 책갈피는 검증 통과에서만).
 *
 * 화면은 밝은 카드다. 어두운 판은 "검사받는 중" 표시라 (CLAUDE.md §7) 놀이에는 쓰지 않는다.
 * 768px 이상은 오른쪽 패널에, 미만은 바텀시트에 담는다 (LibraryScreen).
 */
export function WordQuiz({
  quiz,
  picked,
  onPick,
  onClose,
  closable = true,
}: {
  quiz: WordQuizResponse;
  /** 고른 보기 자리. 아직 안 골랐으면 null */
  picked: number | null;
  onPick: (choice: number) => void;
  onClose: () => void;
  /** 바텀시트는 제 닫기 버튼이 있어 여기 ✕ 를 숨긴다 */
  closable?: boolean;
}) {
  const done = picked !== null;
  const correct = picked === quiz.answer;
  // 문장 속 그 낱말을 굵게 — 어느 낱말을 묻는지 한눈에 보이게
  const at = quiz.sentence.indexOf(quiz.word);

  return (
    <div>
      <div className="flex items-center justify-between gap-2">
        <span className="rounded-full bg-yellow-bg px-3 py-1 text-xs font-bold text-yellow-text">
          🎮 낱말 퀴즈
        </span>
        {closable && (
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
          const tone = !done
            ? "border-border-strong bg-card text-ink active:opacity-80"
            : index === quiz.answer
              ? "border-green bg-green-bg text-green-text"
              : index === picked
                ? "border-coral bg-coral-bg text-coral-text"
                : "border-border bg-card text-faint";
          return (
            <button
              key={index}
              type="button"
              disabled={done}
              onClick={() => onPick(index)}
              className={`min-h-12 rounded-btn border px-4 py-3 text-left text-[15px] font-medium ${tone}`}
            >
              {choice}
              {done && index === quiz.answer && <span aria-label="정답"> ✓</span>}
            </button>
          );
        })}
      </div>

      {done && (
        <>
          <p className="mt-3 text-[15px] leading-relaxed text-ink">
            {correct
              ? "맞았어! 🎉 이제 이 낱말은 네 거야."
              : "아쉬워! 초록 칸이 이 문장에서의 뜻이야. 본문에서 낱말을 누르면 사전도 볼 수 있어."}
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
