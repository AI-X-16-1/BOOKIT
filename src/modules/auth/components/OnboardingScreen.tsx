"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ApiClientError, apiPost } from "@/shared/api/client";
import type {
  ExplorerRank,
  GradeLevel,
  StudentOnboardingResponse,
  TeacherOnboardingResponse,
} from "@/shared/types";
import { Button, cn } from "@/shared/ui";
import { GRADES } from "../grades";
import { ExplorerRankPicker } from "./ExplorerRankPicker";

/**
 * 온보딩. 목업 1 #2 (L60-96).
 *
 * ⚠️ 목업과 다른 점 — 의도적이다.
 * 목업은 학교·반을 자유 입력("한빛초등학교", "2반")으로 그렸지만,
 * CLAUDE.md §4 는 이를 금지한다. 아무나 남의 반 데이터를 읽게 되기 때문이다.
 * 학생은 교사가 만든 6자리 코드로만 들어오고, 반은 교사만 만들 수 있다.
 */
export interface OnboardingScreenProps {
  /** 구글에서 온 이름. profiles.display_name */
  displayName: string;
}

export function OnboardingScreen({ displayName }: OnboardingScreenProps) {
  const router = useRouter();
  const [role, setRole] = useState<"student" | "teacher">("student");
  const [grade, setGrade] = useState<GradeLevel>(2);
  const [code, setCode] = useState("");
  /** 탐험가 등급 — 선택. 안 고르면 null 로 보낸다 (spec §2b) */
  const [rank, setRank] = useState<ExplorerRank | null>(null);
  /**
   * 가입하고 바로 읽기 수준을 볼지 (spec §2c). 기본값은 "할래" 다 —
   * 학년만 고르고 들어가면 그 값이 곧 책 난이도가 되는데, 학년은 나이지 읽기 수준이
   * 아니다. 대신 끄기가 한 번 누르는 것이고, 안 해도 '나' 화면에서 언제든 할 수 있다.
   */
  const [levelTest, setLevelTest] = useState(true);
  // 기본값을 비운다 — "한빛초" 가 채워져 있으면 그대로 제출돼 남의 학교로 반이 생겼다 (#131)
  const [school, setSchool] = useState("");
  const [classNo, setClassNo] = useState(2);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [issued, setIssued] = useState<string | null>(null);

  const submitStudent = async () => {
    setBusy(true);
    setError(null);
    try {
      await apiPost<StudentOnboardingResponse>("/api/onboarding/student", {
        grade_level: grade,
        join_code: code,
        explorer_rank: rank,
      });
      /*
       * 가입 화면에서 고른 대로 간다 (spec §2c).
       *
       * 전에는 무조건 /level-test 로 보냈는데, 그건 선택이 아니라 떠밀기였다 —
       * 진단 화면에 "나중에 할래" 가 있어도 가입 흐름에서는 한 단계가 늘어난 것으로
       * 느껴진다. 여기서 미리 물어 두면 끈 사람은 곧장 홈으로 간다.
       *
       * 학년은 방금 위에서 저장됐다. 진단은 그 값을 기준으로 지문을 고르고,
       * 결과를 받아들일지는 학생이 다시 고른다 (덮어쓰지 않는다 — spec §2c).
       * 시연 로그인(/auth/demo)은 온보딩을 거치지 않으므로 이 경로를 타지 않는다.
       */
      // replace 로 보낸다 — 뒤로 가기로 온보딩에 되돌아오지 않게
      router.replace(levelTest ? "/level-test" : "/home");
    } catch (cause) {
      setError(
        cause instanceof ApiClientError
          ? cause.message
          : "잠깐 문제가 생겼어. 다시 해볼까?",
      );
      setBusy(false);
    }
  };

  const submitTeacher = async () => {
    setBusy(true);
    setError(null);
    try {
      const result = await apiPost<TeacherOnboardingResponse>(
        "/api/onboarding/teacher",
        { school_name: school, grade_level: grade, class_no: classNo },
      );
      setIssued(result.join_code);
    } catch (cause) {
      setError(
        cause instanceof ApiClientError
          ? cause.message
          : "잠깐 문제가 생겼어. 다시 해볼까요?",
      );
    } finally {
      setBusy(false);
    }
  };

  const CODE_LEN = 6;

  return (
    <div className="flex min-h-dvh flex-col bg-notebook px-6 pt-[56px] pb-8">
      {/* 저학년 개편(목업 10 M01): 로고 → "너는 어떤 탐험가야?" → 등급 카드 → 반 코드 칸 → 출발! */}
      <div className="flex items-center justify-center gap-2.5">
        <span
          aria-hidden
          className="flex h-[38px] w-[38px] items-center justify-center rounded-[12px] bg-coral font-display text-[19px] text-white"
        >
          책
        </span>
        <span className="font-display text-[23px] text-ink">책잇</span>
      </div>

      <div className="mt-4 flex justify-center gap-2">
        {(["student", "teacher"] as const).map((r) => (
          <button
            key={r}
            type="button"
            onClick={() => {
              setRole(r);
              setIssued(null);
              setError(null);
            }}
            className={cn(
              "min-h-11 rounded-full px-5 font-display text-[16px]",
              role === r ? "bg-ink text-on-dark" : "border-2 border-border bg-card text-muted",
            )}
          >
            {r === "student" ? "학생이에요" : "선생님이에요"}
          </button>
        ))}
      </div>

      {role === "student" ? (
        <>
          <h1 className="mt-6 text-center text-[38px] leading-[1.15] text-ink">
            {displayName}아,
            <br />
            너는 어떤 탐험가야?
          </h1>
          <p className="mt-2 text-center text-[18px] font-medium text-muted">하나만 골라줘</p>

          <div className="mt-6">
            <ExplorerRankPicker value={rank} onChange={setRank} disabled={busy} />
          </div>

          {/* 학년 — 초1~3 (#192). 난이도에 쓰인다 */}
          <div className="mt-7 flex items-center justify-center gap-2.5">
            <span className="mr-1 text-[17px] font-medium text-muted">몇 학년이야?</span>
            {GRADES.map((g) => (
              <button
                key={g.value}
                type="button"
                onClick={() => setGrade(g.value)}
                aria-pressed={grade === g.value}
                className={cn(
                  "min-h-12 min-w-[64px] rounded-full px-4 font-display text-[19px]",
                  grade === g.value ? "bg-coral text-white" : "border-[3px] border-border bg-card text-muted",
                )}
              >
                {g.label}
              </button>
            ))}
          </div>

          {/* 반 코드 — 6칸. 진짜 입력은 투명 input 하나고 칸은 그림이다 */}
          <div className="mt-7 flex flex-col items-center gap-3">
            <span className="text-[17px] font-medium text-muted">선생님이 알려준 반 코드</span>
            <label className="relative flex gap-2">
              <input
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, CODE_LEN))}
                maxLength={CODE_LEN}
                autoCapitalize="characters"
                autoComplete="one-time-code"
                aria-label="반 참여 코드 6자리"
                className="absolute inset-0 z-10 cursor-text opacity-0"
              />
              {Array.from({ length: CODE_LEN }, (_, i) => {
                const ch = code[i] ?? "";
                const isCursor = i === code.length;
                return (
                  <span
                    key={i}
                    aria-hidden
                    className={cn(
                      "flex h-[66px] w-[54px] items-center justify-center rounded-[16px] font-display text-[30px] text-ink",
                      ch
                        ? "border-[3px] border-border bg-card"
                        : isCursor
                          ? "border-[3px] border-coral bg-coral-bg"
                          : "border-[3px] border-dashed border-border bg-card",
                    )}
                  >
                    {ch || (isCursor ? <span className="h-8 w-[3px] bg-coral animate-[bookit-caret_1s_steps(1)_infinite]" /> : null)}
                  </span>
                );
              })}
            </label>
            <p className="text-[14px] text-faint">학교·반은 직접 안 적어. 코드로만 들어와야 다른 반이랑 안 섞여</p>
          </div>

          {/* 읽기 수준 진단 여부 (spec §2c) */}
          <div className="mt-6 flex items-center gap-3.5 rounded-card border-[3px] border-border bg-card p-4">
            <span aria-hidden className="flex h-12 w-12 flex-none items-center justify-center rounded-full bg-blue-bg text-[24px]">📖</span>
            <span className="min-w-0 flex-1">
              <span className="block font-display text-[19px] text-ink">읽기 수준도 볼래?</span>
              <span className="block text-[14px] text-muted">짧은 글 하나, 세 문제. 시험 아니야</span>
            </span>
            <div className="flex gap-1.5">
              {([true, false] as const).map((v) => (
                <button
                  key={String(v)}
                  type="button"
                  onClick={() => setLevelTest(v)}
                  disabled={busy}
                  aria-pressed={levelTest === v}
                  className={cn(
                    "min-h-11 rounded-full px-3.5 font-display text-[16px]",
                    levelTest === v ? "bg-coral text-white" : "border-2 border-border bg-card text-muted",
                  )}
                >
                  {v ? "할래" : "나중에"}
                </button>
              ))}
            </div>
          </div>
        </>
      ) : (
        <>
          <h1 className="mt-6 text-center text-[34px] leading-[1.2] text-ink">
            반가워요, {displayName} 선생님
          </h1>
          <p className="mt-2 text-center text-[17px] font-medium text-muted">반을 만들면 아이들이 들어올 코드가 나와요</p>

          <div className="mt-6 text-[15px] font-medium text-muted">학년</div>
          <div className="mt-2 flex gap-2.5">
            {GRADES.map((g) => (
              <button
                key={g.value}
                type="button"
                onClick={() => setGrade(g.value)}
                aria-pressed={grade === g.value}
                className={cn(
                  "min-h-12 flex-1 rounded-full font-display text-[19px]",
                  grade === g.value ? "bg-coral text-white" : "border-[3px] border-border bg-card text-muted",
                )}
              >
                {g.label}
              </button>
            ))}
          </div>
          <div className="mt-5 text-[15px] font-medium text-muted">학교</div>
          <input
            value={school}
            onChange={(e) => setSchool(e.target.value)}
            placeholder="예: 한빛초"
            className="mt-1.5 rounded-input border-[3px] border-border bg-card p-[17px] text-[19px] text-ink outline-none placeholder:text-faint focus:border-coral"
          />
          <div className="mt-3.5 text-[15px] font-medium text-muted">반</div>
          <input
            type="number"
            min={1}
            value={classNo}
            onChange={(e) => setClassNo(Number(e.target.value))}
            className="mt-1.5 rounded-input border-[3px] border-border bg-card p-[17px] text-[19px] text-ink outline-none focus:border-coral"
          />
          {issued && (
            <div className="mt-4 rounded-card border-[3px] border-yellow bg-yellow-bg p-4 text-center">
              <div className="text-[15px] text-yellow-text-2">반 참여 코드</div>
              <div className="mt-1.5 font-display text-[40px] tracking-[0.2em] text-ink">
                {issued}
              </div>
              {/* 보호자 동의를 받는 주체는 학교다 (#94). 학생에게 자기 확인 체크박스를
                  받는 건 법적 동의가 아니라서 학생 화면에는 두지 않는다 (개인정보보호법 §22-2) */}
              <p className="mt-2 text-[14px] text-yellow-text">
                보호자 동의를 받은 학생에게만 이 코드를 알려주세요
              </p>
            </div>
          )}
        </>
      )}

      {error && <p className="mt-3 text-center text-[16px] font-bold text-coral">{error}</p>}

      <div className="flex-1" />

      <div className="pt-7">
        {role === "student" ? (
          <Button disabled={busy || code.length !== CODE_LEN} onClick={submitStudent}>
            {busy ? "확인하는 중…" : "출발! →"}
          </Button>
        ) : issued ? (
          <Button variant="dark" onClick={() => router.push("/teacher")}>
            대시보드로 가기
          </Button>
        ) : (
          <Button variant="dark" disabled={busy || !school.trim()} onClick={submitTeacher}>
            {busy ? "만드는 중…" : "반 만들고 코드 받기"}
          </Button>
        )}
      </div>
    </div>
  );
}
