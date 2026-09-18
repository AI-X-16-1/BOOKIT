"use client";

import { useState } from "react";
import type { AnswerCheckpointResponse } from "@/shared/types";
import { BottomSheet, Button, cn } from "@/shared/ui";

/**
 * 체크포인트 — 장 끝에서 묻는 한 문항. 목업 7 #7 (모바일) · 목업 8 #8 (태블릿).
 *
 * 9/18 마감 스프린트(docs/sprint-0918.md) ③. 이 파일은 **화면만**이다.
 * 질문을 만드는 것(AI #6)과 판정은 `modules/ai` 쪽이고 강민구 몫이라, 여기서는
 * spec §5b 의 응답(`AnswerCheckpointResponse`)을 받아 그리기만 한다.
 *
 * 검증(보스전)과 뭐가 다른가 — 이 셋을 화면이 지켜야 한다 (spec §2b):
 *   1. **책갈피가 없다.** 통과해도 0. 그래서 점수·획득 줄을 그리지 않는다
 *   2. **시간 제한이 없다.** 목업에 `00:38` 이 있지만 spec 은 제한 없음이다.
 *      타이머는 검증 전용 장치다 — 부정행위를 막을 이유가 여기엔 없고, 읽다가
 *      멈춰 세워 놓고 초를 세면 읽기가 시험이 된다. #136 에 결정 요청을 올려 뒀고
 *      답이 오기 전까지는 확정된 spec 쪽(제한 없음)으로 간다
 *   3. **주는 것은 부화뿐이다.** 통과하면 알이 깨진다 (0014 트리거가 stage 1 로)
 *
 * 표지 조각은 이 화면이 주지 않는다. 목업은 "통과하면 조각 1개가 열려요" 라고
 * 적었지만 확정된 spec §2b 에서 조각 = **읽은 장** 이다 (#140 과 같은 판단).
 * 그래서 조각 줄은 약속이 아니라 이미 일어난 일을 알려 준다.
 *
 * 색: 목업의 하늘색(#8FC9EC)은 tokens.css 에 없어 만들지 않고 `--blue`(#7CBBE6)로
 * 썼다. 어두운 패널 위에서 같은 역할을 한다 (CLAUDE.md §7 · #140 의 보라와 같은 처리).
 */

export interface CheckpointPanelProps {
  /** 몇 장 끝인지. 칩에 그대로 보인다 */
  chapterNo: number;
  /** AI #6 이 그 장 본문으로 만든 한 문항 */
  question: string;
  /** 표지 퍼즐 진행률 — 조각 = 읽은 장 (spec §2b) */
  readChapters: number;
  totalChapters: number;
  /** 채점 결과. null 이면 아직 답하기 전이다 */
  result?: AnswerCheckpointResponse | null;
  submitting?: boolean;
  /** 서버가 준 오류 문구. 아이가 그대로 읽는 문장이다 */
  error?: string | null;
  onSubmit: (answer: string) => void;
  /** "조금 더 읽고 답할래요" — 읽던 자리로 돌아간다 */
  onClose: () => void;
  className?: string;
}

/** 검증 답안과 같은 상한 (verification/schema.ts). 프롬프트가 길어지는 걸 막는 용도다 */
const MAX_LENGTH = 2000;

function Chip({ chapterNo }: { chapterNo: number }) {
  return (
    <span className="rounded-full bg-panel-inner px-3 py-1.5 text-[11px] font-bold text-blue">
      📍 체크포인트 · {chapterNo}장 끝
    </span>
  );
}

export function CheckpointPanel({
  chapterNo,
  question,
  readChapters,
  totalChapters,
  result = null,
  submitting = false,
  error = null,
  onSubmit,
  onClose,
  className,
}: CheckpointPanelProps) {
  const [answer, setAnswer] = useState("");

  const percent =
    totalChapters > 0
      ? Math.round((Math.min(readChapters, totalChapters) / totalChapters) * 100)
      : 0;

  /* ── 답한 뒤 ─────────────────────────────────── */
  if (result) {
    // 알이 깨진 순간에만 알린다. 이미 부화해 있던 캐릭터는 말을 얹지 않는다
    const hatched = result.character_stage === 1;

    return (
      <div className={cn("flex flex-col gap-4", className)}>
        <Chip chapterNo={chapterNo} />

        <div className="rounded-[14px] bg-card p-5">
          <div className="flex items-center gap-3">
            <span
              className={cn(
                "flex h-11 w-11 flex-none items-center justify-center rounded-full text-xl",
                result.passed ? "bg-green text-white" : "bg-yellow-bg text-yellow-text",
              )}
              aria-hidden
            >
              {result.passed ? "✓" : "…"}
            </span>
            <div className="text-lg font-bold text-ink">
              {/* 틀렸다고 말하지 않는다 — 책갈피도 안 걸린 확인 문항이다 (CLAUDE.md §9) */}
              {result.passed ? "잘 읽고 있어!" : "여기 한 번 더 볼까?"}
            </div>
          </div>
          <p className="mt-3.5 text-[15px] leading-relaxed text-ink-warm">
            {result.feedback}
          </p>
        </div>

        {hatched && (
          <div className="flex items-center gap-3 rounded-xl bg-panel-inner px-4 py-3.5">
            <span className="text-lg" aria-hidden>
              🥚→🐣
            </span>
            <span className="flex-1 text-[13px] text-panel-text">
              알이 부화했어! 도감에서 볼 수 있어
            </span>
          </div>
        )}

        <Button onClick={onClose}>계속 읽기</Button>
      </div>
    );
  }

  /* ── 답하기 전 ───────────────────────────────── */
  return (
    <div className={cn("flex flex-col gap-3.5", className)}>
      <Chip chapterNo={chapterNo} />

      {/* 읽기 진행률. 목업의 62% 자리다 — 시간이 아니라 읽은 양을 보여준다 */}
      <div
        className="h-1 overflow-hidden rounded-full bg-panel-line"
        role="img"
        aria-label={`${totalChapters}장 중 ${readChapters}장 읽음`}
      >
        <div className="h-1 rounded-full bg-blue" style={{ width: `${percent}%` }} />
      </div>

      <p className="rounded-[14px] bg-card p-5 text-[17px] leading-relaxed text-ink">
        {question}
      </p>

      <textarea
        value={answer}
        onChange={(e) => setAnswer(e.target.value)}
        maxLength={MAX_LENGTH}
        disabled={submitting}
        rows={4}
        aria-label="체크포인트 답"
        placeholder="읽은 데까지만 생각하고 답해도 괜찮아"
        className="min-h-[118px] resize-none rounded-[14px] bg-panel-inner p-[18px] text-base leading-relaxed text-panel-text placeholder:text-panel-muted focus:outline-2 focus:outline-coral disabled:opacity-60"
      />

      {/* 조각은 이 문항이 주는 상이 아니라 이 장을 읽어서 이미 열린 것이다 */}
      {totalChapters > 0 && (
        <div className="flex items-center gap-2.5 rounded-xl bg-panel-inner px-4 py-3.5">
          <span className="text-lg" aria-hidden>
            🧩
          </span>
          <span className="flex-1 text-[13px] text-panel-text">
            이 장을 읽어서 표지 조각이 열렸어
          </span>
          <span className="flex-none text-xs font-bold text-yellow">
            {Math.min(readChapters, totalChapters)} / {totalChapters}
          </span>
        </div>
      )}

      {error && <p className="text-center text-sm text-coral-light">{error}</p>}

      <Button
        onClick={() => onSubmit(answer)}
        disabled={submitting || answer.trim() === ""}
      >
        {submitting ? "읽어보는 중이야…" : "답변 제출"}
      </Button>

      {/* 빠져나갈 길을 늘 남긴다. 답하지 않아도 잃는 것은 없다 */}
      <button
        type="button"
        onClick={onClose}
        className="min-h-12 text-center text-sm text-panel-muted"
      >
        조금 더 읽고 답할래요
      </button>
    </div>
  );
}

/**
 * 768px 미만에서 쓰는 바텀시트 껍데기 (CLAUDE.md §8).
 * 768px 이상은 읽기 화면 옆 패널이라(목업 8 #8), 부르는 쪽이 CheckpointPanel 을
 * 그대로 aside 에 넣는다 — 사전이 이미 그렇게 갈린다 (reader 의 LibraryScreen).
 */
export function CheckpointSheet({
  open,
  ...props
}: CheckpointPanelProps & { open: boolean }) {
  return (
    <BottomSheet
      open={open}
      onClose={props.onClose}
      label="체크포인트"
      className="bg-panel"
    >
      <CheckpointPanel {...props} />
    </BottomSheet>
  );
}
