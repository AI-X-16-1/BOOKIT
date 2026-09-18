"use client";

import Link from "next/link";

import type { AnswerResponse } from "@/shared/types";
import { Button } from "@/shared/ui";
import {
  BOSS_AXES,
  bossHits,
  bossHpNote,
  HIT_LABEL,
  STYLE_HIT_LABEL,
} from "./labels";

/**
 * 채점 결과 = 보스전 결과. 목업 7 #2·#3 (docs/mockups/7 보스전·성장 개편 (모바일).dc.html).
 *
 * 9/18 마감 스프린트(docs/sprint-0918.md) ① — 같은 결과를 "포획 성공/실패" 로 연출한다.
 * **채점 로직·점수·책갈피는 그대로고 보이는 것만 바뀐다** (스프린트 불변식). 이 파일은
 * 서버 응답(AnswerResponse)을 새로 해석하지 않는다 — 세 축과 passed·points 를 받아
 * 프레임만 보스전으로 바꾼다.
 *
 * 보스 HP 는 질문 수가 아니라 채점 3축이다 (labels.ts 의 bossHits 주석).
 * 목업의 "3문 중 N문" 을 그대로 만들려면 질문을 3개 던져야 하는데 그건 파이프라인
 * 변경이라 금지다.
 *
 * 색: 목업은 보라 계열(#1D1621 배경 · #C69BFF 강조 · #2E2436 패널)을 쓰지만
 * tokens.css 에 없는 색이라 임의로 만들지 않았다 (CLAUDE.md §2, tokens.css 머리말).
 * 지금은 기존 검증 화면 토큰(--panel / --panel-inner / --panel-line / coral)으로
 * 그린다 — 어두운 대비 자체가 "검사받는 중" 신호라 §7 은 지켜진다. 보라 3색은
 * 김민경에게 요청해 두었고, 등재되면 이 파일의 panel-* 만 바꾸면 된다.
 *
 * 실패 화면은 CLAUDE.md §9 를 따른다 — 벌처럼 보이지 않게, 무엇을 더하면 되는지
 * 말하고 재시도를 준다. 그래서 실패 쪽에는 포획 도장도, 책갈피 줄도, 장식 별도 없다.
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

/** 축 한 칸. 때린 축은 초록, 못 때린 축은 코랄 (목업 7 #3 의 3칸 그리드) */
function Axis({ name, value, hit }: { name: string; value: string; hit: boolean }) {
  return (
    <div
      className={`rounded-[11px] p-3.5 text-center ${hit ? "bg-green-bg" : "bg-coral-bg"}`}
    >
      <div className={`text-[11px] ${hit ? "text-green-text" : "text-coral-text"}`}>
        {name}
      </div>
      <div
        className={`mt-[3px] text-[15px] font-bold ${hit ? "text-green-text" : "text-coral-text"}`}
      >
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

  const hits = bossHits(scores);
  const hp = BOSS_AXES - hits;

  return (
    <div className="-mx-[22px] -mt-[52px] flex min-h-dvh flex-col bg-panel px-[22px] pt-[52px] pb-[26px] md:mx-0 md:mt-0 md:min-h-0 md:flex-1 md:rounded-card md:pt-8">
      {/* 보스 이름과 명중 수. 보스 = 그 책이다 */}
      <div className="flex items-center justify-between gap-3">
        <span className="min-w-0 truncate font-mono text-xs tracking-[0.2em] text-coral-light">
          BOSS · {bookTitle}
        </span>
        <span className="flex-none rounded-full bg-panel-inner px-[11px] py-1.5 text-[11px] font-bold text-on-dark-2">
          {BOSS_AXES}군데 중 {hits}군데
        </span>
      </div>

      <div className="relative mt-[26px]">
        {/* 장식 별 — 통과했을 때만 */}
        {passed && (
          <>
            <span className="absolute top-2 left-4 text-lg text-star-warm">★</span>
            <span className="absolute top-16 right-8 text-sm text-coral-light">★</span>
            <span className="absolute bottom-2 left-12 text-xs text-star-cool">★</span>
          </>
        )}

        {/* 보스. 캐릭터 그림은 ②(도감, characters.art_seed)에서 오고 지금은 자리표시자다 */}
        <div className="flex justify-center">
          <div className="relative flex h-[196px] w-[196px] items-center justify-center rounded-full border-[3px] border-panel-line bg-radial-[at_34%_30%] from-panel-inner to-panel to-[72%]">
            <span className="text-[60px]" aria-hidden>
              🐉
            </span>
            {passed && (
              <div className="absolute -inset-3.5 rounded-full border-2 border-dashed border-panel-line" />
            )}
          </div>
        </div>
      </div>

      {/* HP — 못 때린 축의 수 */}
      <div className="mt-5 text-center">
        <div className="font-mono text-xs text-panel-muted">BOSS HP</div>
        <div
          className="mt-2.5 h-3 overflow-hidden rounded-full bg-panel-inner"
          role="img"
          aria-label={`보스 HP ${hp} / ${BOSS_AXES}`}
        >
          <div
            className="h-3 rounded-full bg-coral transition-[width] duration-500"
            style={{ width: `${(hp / BOSS_AXES) * 100}%` }}
          />
        </div>
        <div className="mt-2 text-xs text-panel-muted">
          {hp} / {BOSS_AXES} · {bossHpNote(hp, passed)}
        </div>
      </div>

      {/* 결과 카드 — 어두운 화면 위의 크림 카드 */}
      <div className="relative mt-[26px] rounded-[20px] bg-cream p-6">
        {/* 포획 도장 — 통과했을 때만 */}
        {passed && (
          <div className="absolute -top-5 -right-3.5 flex h-[78px] w-[78px] -rotate-8 flex-col items-center justify-center rounded-full border-[3px] border-dashed border-stamp-ring bg-yellow shadow-[0_8px_20px_rgba(0,0,0,.3)]">
            <span className="text-[15px] text-yellow-text">★</span>
            <span className="text-xs font-bold text-stamp-text">포획</span>
          </div>
        )}

        <div className="flex items-center gap-3.5">
          <div
            className={`flex h-13 w-13 flex-none items-center justify-center rounded-full text-2xl ${passed ? "bg-green text-white" : "bg-coral-bg-2 text-coral-deep"}`}
          >
            {passed ? "✓" : "!"}
          </div>
          <div className="min-w-0">
            <div className="text-2xl font-bold text-ink">
              {passed ? "포획 성공!" : "놓쳤어요!"}
            </div>
            <div className="mt-[3px] text-[13px] text-muted">
              {passed
                ? `${bookTitle} 보스를 쓰러뜨렸어요`
                : "한 번만 더 다듬으면 잡을 수 있어요"}
            </div>
          </div>
        </div>

        {/* AI 피드백. 통과는 결정타, 실패는 힌트로 읽힌다 — 문장은 서버가 준 그대로다 */}
        <div className="mt-5 rounded-[14px] bg-yellow-bg p-4">
          <div className="text-[13px] font-bold text-yellow-text">
            {passed ? "✎ 결정타가 된 문장" : "✎ 약점 힌트"}
          </div>
          <p className="mt-[7px] text-sm leading-[1.7] text-yellow-text-2">
            {feedback}
          </p>
        </div>

        {/* 채점 3축 = HP 세 칸. 목업은 실패 화면에만 3칸을 뒀지만 양쪽 다 보여준다 —
            통과한 아이도 어디를 때렸는지 알아야 다음 책에서 또 때릴 수 있다 */}
        <div className="mt-3 grid grid-cols-3 gap-2">
          <Axis
            name="정합성"
            value={HIT_LABEL[scores.logic_consistency]}
            hit={scores.logic_consistency === "pass"}
          />
          <Axis
            name="구체성"
            value={HIT_LABEL[scores.specificity]}
            hit={scores.specificity === "pass"}
          />
          <Axis
            name="문체"
            value={STYLE_HIT_LABEL[scores.style_consistency]}
            hit={scores.style_consistency === "same"}
          />
        </div>

        {/* 실패는 0점을 강조하지 않는다 — 규칙만 조용히 알려준다 */}
        {!passed && (
          <div className="mt-3.5 flex items-center justify-between gap-3 rounded-xl bg-sunken px-4 py-3.5">
            <span className="text-[13px] text-coral-text-2">
              책갈피는 포획 성공에만 지급돼요
            </span>
            <span className="flex-none text-[15px] font-bold text-faint">+0</span>
          </div>
        )}
      </div>

      {/* 책갈피 — 통과했을 때만 */}
      {passed && (
        <>
          <div className="mt-4 flex items-center justify-between rounded-[18px] bg-panel-inner p-5">
            <span className="text-base font-bold text-on-dark">🔖 책갈피 획득</span>
            <span className="text-[26px] font-bold text-yellow">+{points}</span>
          </div>
          {streakDays > 0 && (
            <p className="mt-3 text-center text-sm text-panel-muted">
              {streakDays}일째 연속으로 포획하고 있어요 🔥
            </p>
          )}
        </>
      )}

      {error && (
        <p className="mt-3 text-center text-sm text-coral-light">{error}</p>
      )}

      <div className="flex-1" />

      {!passed && (
        <p className="mt-4 text-center text-xs text-panel-muted">
          다시 도전하면 새 질문이 나와요
        </p>
      )}

      <div className="mt-3 flex gap-2.5">
        {passed ? (
          <>
            {/* 목업 7 #2 의 주 버튼. ②(도감)가 붙어서 이제 연결한다 —
                방금 잡은 캐릭터는 트리거가 이미 stage 2 로 올려 둔 뒤라 (0014)
                도감을 열면 바로 보인다. "다음 책" 은 탭바의 홈·서재가 받는다 */}
            <Link
              href="/collection"
              className="min-h-12 w-full rounded-btn bg-coral px-5 py-[19px] text-center text-[17px] font-bold text-white active:opacity-80"
            >
              도감에서 보기
            </Link>
            <Button
              variant="dark"
              fullWidth={false}
              className="flex-none bg-panel-inner px-[18px]"
            >
              ⤳ 공유
            </Button>
          </>
        ) : (
          <>
            <Button onClick={onRetry} disabled={retrying}>
              {retrying ? "새 질문을 만들고 있어…" : "다시 도전하기"}
            </Button>
            <Button
              variant="dark"
              fullWidth={false}
              onClick={onDone}
              className="flex-none bg-panel-inner px-[18px]"
            >
              나중에
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
