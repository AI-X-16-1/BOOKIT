"use client";

import { useState } from "react";
import Link from "next/link";
import { apiPost, apiPatch } from "@/shared/api/client";
import { Button } from "@/shared/ui";

/**
 * 읽기 수준 진단 화면. owner: 박재경
 *
 * 계약: docs/spec.md §2c·§5c.
 *
 * 세 화면이 한 파일에 있다 — 안내 → 지문·문항 → 결과. 셋이 같은 상태를 이어
 * 쓰고 화면 사이에 저장이 없어서(표를 만들지 않는다) 쪼개면 상태를 위로 끌어올려야 한다.
 *
 * 시험처럼 보이지 않게 하는 것이 이 화면의 일이다 (CLAUDE.md §9):
 *   - 타이머가 없다. 검증의 30~60초는 부정행위를 막는 장치이고 여기엔 막을 것이 없다
 *   - 점수·정답·오답 표시가 없다. 결과는 추천 학년 하나와 반말 두세 문장뿐이다
 *   - 건너뛸 수 있고, 결과를 받아들일지도 학생이 고른다
 */

interface StartResponse {
  book_id: string;
  book_title: string;
  author: string;
  passage: string;
  questions: string[];
}

interface GradeResponse {
  recommended_grade: number;
  confidence: "low" | "medium" | "high";
  feedback: string;
  current_grade: number | null;
}

/** 1~9 → 사람이 읽는 말 (spec §1 의 grade_level 눈금) */
function gradeLabel(grade: number): string {
  return grade <= 6 ? `초등 ${grade}학년` : `중학 ${grade - 6}학년`;
}

export interface LevelTestScreenProps {
  /** 끝난 뒤 돌아갈 곳. 온보딩에서 부르면 /home, '나' 에서 부르면 /me */
  doneHref?: string;
}

export function LevelTestScreen({ doneHref = "/home" }: LevelTestScreenProps) {
  const [test, setTest] = useState<StartResponse | null>(null);
  const [answers, setAnswers] = useState(["", "", ""]);
  const [result, setResult] = useState<GradeResponse | null>(null);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const start = async () => {
    setBusy(true);
    setError(null);
    try {
      setTest(await apiPost<StartResponse>("/api/level-test", {}));
    } catch {
      setError("지문을 못 받아왔어. 잠깐 뒤에 다시 해볼까?");
    } finally {
      setBusy(false);
    }
  };

  const submit = async () => {
    if (!test) return;
    setBusy(true);
    setError(null);
    try {
      setResult(
        await apiPost<GradeResponse>("/api/level-test/grade", {
          book_id: test.book_id,
          questions: test.questions,
          answers,
        }),
      );
    } catch {
      setError("지금은 답을 볼 수 없어. 잠깐 뒤에 다시 해볼까?");
    } finally {
      setBusy(false);
    }
  };

  /** 추천 학년을 프로필에 넣는다. 이 진단이 남기는 유일한 자국이다 */
  const accept = async () => {
    if (!result) return;
    setBusy(true);
    setError(null);
    try {
      await apiPatch("/api/profile", { grade_level: result.recommended_grade });
      setSaved(true);
    } catch {
      setError("학년을 바꾸지 못했어. '나' 화면에서 다시 해볼까?");
    } finally {
      setBusy(false);
    }
  };

  /* ── 결과 ─────────────────────────────────────── */
  if (result) {
    const same = result.current_grade === result.recommended_grade;

    return (
      <div className="flex flex-col gap-4">
        <div className="rounded-card bg-card p-6">
          <div className="text-[13px] font-bold text-muted">읽기 수준</div>
          <div className="mt-1.5 text-2xl font-bold text-ink">
            {same ? "지금 학년이 딱 맞아!" : `${gradeLabel(result.recommended_grade)} 책이 맞을 것 같아`}
          </div>
          <p className="mt-3.5 text-[15px] leading-relaxed text-ink-warm">{result.feedback}</p>

          {/* 확신이 낮으면 바꾸라고 밀지 않는다 — 한 번 읽고 정할 일이 아니다 */}
          {result.confidence === "low" && (
            <p className="mt-3 text-[13px] text-faint">
              지문 하나로 본 거라 확실하진 않아. 그대로 둬도 괜찮아
            </p>
          )}
        </div>

        {error && <p className="text-center text-sm text-coral-text">{error}</p>}

        {saved ? (
          <>
            <p className="text-center text-sm text-green-text">
              {gradeLabel(result.recommended_grade)}(으)로 바꿨어
            </p>
            <Link
              href={doneHref}
              className="min-h-12 w-full rounded-btn bg-coral px-5 py-[19px] text-center text-[17px] font-bold text-white"
            >
              책 보러 가기
            </Link>
          </>
        ) : (
          <div className="flex flex-col gap-2.5">
            {!same && (
              <Button onClick={accept} disabled={busy}>
                {busy ? "바꾸는 중…" : `${gradeLabel(result.recommended_grade)}으로 할래`}
              </Button>
            )}
            <Link
              href={doneHref}
              className="min-h-12 w-full rounded-btn border border-border-strong bg-card px-5 py-[19px] text-center text-[17px] font-bold text-ink"
            >
              {same ? "책 보러 가기" : "그대로 둘래"}
            </Link>
          </div>
        )}
      </div>
    );
  }

  /* ── 지문 · 문항 ──────────────────────────────── */
  if (test) {
    return (
      <div className="flex flex-col gap-4">
        <div>
          <h1 className="text-[22px] font-bold text-ink">읽고 답해줘</h1>
          <p className="mt-1.5 text-sm text-muted">
            {test.book_title} · {test.author}
          </p>
        </div>

        {/* 지문. 서재와 같은 본문 크기·행간 (CLAUDE.md §8) */}
        <div className="rounded-card bg-card p-5 text-[18px] leading-[2] whitespace-pre-line text-ink">
          {test.passage}
        </div>

        {test.questions.map((question, i) => (
          <div key={i} className="flex flex-col gap-2">
            <p className="text-[15px] font-bold text-ink">{question}</p>
            <textarea
              value={answers[i]}
              onChange={(e) =>
                setAnswers((prev) => prev.map((a, j) => (j === i ? e.target.value : a)))
              }
              maxLength={600}
              rows={3}
              disabled={busy}
              aria-label={`${i + 1}번 답`}
              placeholder="생각나는 대로 한두 줄이면 돼"
              className="min-h-[88px] resize-none rounded-[14px] border border-border-soft bg-card p-4 text-base leading-relaxed text-ink placeholder:text-faint focus:outline-2 focus:outline-coral disabled:opacity-60"
            />
          </div>
        ))}

        {error && <p className="text-center text-sm text-coral-text">{error}</p>}

        {/* 빈 답도 낼 수 있다 — 모르겠으면 넘어가도 된다는 뜻이다 */}
        <Button onClick={submit} disabled={busy}>
          {busy ? "읽어보는 중이야…" : "다 썼어"}
        </Button>
      </div>
    );
  }

  /* ── 안내 ─────────────────────────────────────── */
  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-[26px] leading-[1.3] font-bold text-ink">
          어떤 책이
          <br />
          잘 맞을까?
        </h1>
        <p className="mt-3 text-[15px] leading-relaxed text-muted">
          짧은 글 하나를 읽고 세 가지만 답하면, 너한테 맞는 책 난이도를 찾아줄게.
          <br />
          시험이 아니야 — 점수도 없고 틀려도 괜찮아.
        </p>
      </div>

      {error && <p className="text-center text-sm text-coral-text">{error}</p>}

      <Button onClick={start} disabled={busy}>
        {busy ? "지문을 고르는 중…" : "해볼래"}
      </Button>
      <Link
        href={doneHref}
        className="min-h-12 text-center text-sm leading-[48px] text-muted"
      >
        나중에 할래
      </Link>
    </div>
  );
}
