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
import { Button, Chip, cn } from "@/shared/ui";
import { EXPLORER_RANKS } from "../explorer";
import { GRADES, gradeLabel } from "../grades";

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
  const [grade, setGrade] = useState<GradeLevel>(5);
  const [code, setCode] = useState("");
  /** 탐험가 등급 — 선택. 안 고르면 null 로 보낸다 (spec §2b) */
  const [rank, setRank] = useState<ExplorerRank | null>(null);
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
      // replace 로 보낸다 — 뒤로 가기로 온보딩에 되돌아오지 않게
      router.replace("/home");
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

  return (
    <div className="flex min-h-dvh flex-col px-6 pt-[52px] pb-8">
      <div className="flex items-center gap-3.5">
        <div className="flex h-13 w-13 flex-none items-center justify-center rounded-full bg-yellow text-[19px] font-bold text-stamp-text">
          {displayName.slice(0, 1)}
        </div>
        <div>
          <div className="text-[23px] font-bold text-ink">
            반가워요, {displayName}님!
          </div>
          <div className="mt-1 text-sm text-muted">
            학년·반은 추천과 랭킹에 쓰여요
          </div>
        </div>
      </div>

      <div className="mt-7 flex gap-2">
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
              "min-h-12 flex-1 rounded-btn px-4 py-3 text-[15px] font-bold",
              role === r
                ? "bg-ink text-on-dark"
                : "border border-border bg-card text-ink",
            )}
          >
            {r === "student" ? "학생이에요" : "선생님이에요"}
          </button>
        ))}
      </div>

      <div className="mt-6 text-[15px] font-bold text-coral-text-2">
        학년을 골라줘
      </div>
      <div className="mt-2.5 rounded-btn border-[1.5px] border-coral bg-white px-[18px] py-[17px] text-[17px] text-ink">
        {gradeLabel(grade)}
      </div>
      <div className="mt-3 grid grid-cols-3 gap-2.5">
        {GRADES.map((g) => (
          <button
            key={g.value}
            type="button"
            onClick={() => setGrade(g.value)}
            className={cn(
              "min-h-12 rounded-xl p-[17px] text-base",
              grade === g.value
                ? "bg-coral font-bold text-white"
                : "bg-yellow-bg text-coral-text-2",
            )}
          >
            {g.label}
          </button>
        ))}
      </div>

      {role === "student" ? (
        <>
          {/* 탐험가 등급 — 자기 선언, 건너뛰어도 된다. 화면 톤에만 쓴다 (spec §2b) */}
          <div className="mt-6 text-[15px] font-bold text-coral-text-2">
            너는 어떤 탐험가야?{" "}
            <span className="text-[13px] font-normal text-faint">(안 골라도 돼)</span>
          </div>
          <div className="mt-2.5 grid grid-cols-3 gap-2.5">
            {EXPLORER_RANKS.map((r) => (
              <button
                key={r.value}
                type="button"
                aria-pressed={rank === r.value}
                onClick={() => setRank(rank === r.value ? null : r.value)}
                className={cn(
                  "flex min-h-12 flex-col items-center justify-center gap-1 rounded-xl px-2 py-3",
                  rank === r.value
                    ? "bg-coral text-white"
                    : "bg-yellow-bg text-coral-text-2",
                )}
              >
                <span className="text-[22px] leading-none" aria-hidden>
                  {r.emoji}
                </span>
                <span className="text-[15px] font-bold">{r.value}</span>
                <span
                  className={cn(
                    "text-[11px] leading-tight",
                    rank === r.value ? "text-white/85" : "text-muted",
                  )}
                >
                  {r.blurb}
                </span>
              </button>
            ))}
          </div>

          <div className="mt-6 text-[13px] text-muted">반 참여 코드</div>
          <input
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            maxLength={6}
            placeholder="선생님이 알려준 6자리"
            className="mt-1.5 rounded-xl border border-border bg-white p-[17px] text-[17px] tracking-[0.2em] text-ink outline-none placeholder:tracking-normal placeholder:text-faint focus:border-coral"
          />
          <p className="mt-2 text-[13px] text-faint">
            학교·반을 직접 적지 않아. 코드로만 들어와야 다른 반 기록이 섞이지
            않거든.
          </p>
        </>
      ) : (
        <>
          <div className="mt-6 text-[13px] text-muted">학교</div>
          <input
            value={school}
            onChange={(e) => setSchool(e.target.value)}
            placeholder="예: 한빛초"
            className="mt-1.5 rounded-xl border border-border bg-white p-[17px] text-[17px] text-ink outline-none placeholder:text-faint focus:border-coral"
          />
          <div className="mt-3.5 text-[13px] text-muted">반</div>
          <input
            type="number"
            min={1}
            value={classNo}
            onChange={(e) => setClassNo(Number(e.target.value))}
            className="mt-1.5 rounded-xl border border-border bg-white p-[17px] text-[17px] text-ink outline-none focus:border-coral"
          />
          {issued && (
            <div className="mt-4 rounded-card bg-yellow-bg p-4 text-center">
              <div className="text-[13px] text-yellow-text-2">반 참여 코드</div>
              <div className="mt-1.5 text-[28px] font-bold tracking-[0.2em] text-ink">
                {issued}
              </div>
              {/* 보호자 동의를 받는 주체는 학교다 (#94). 학생에게 자기 확인 체크박스를
                  받는 건 법적 동의가 아니라서 학생 화면에는 두지 않는다 (개인정보보호법 §22-2) */}
              <p className="mt-2 text-[13px] text-yellow-text">
                보호자 동의를 받은 학생에게만 이 코드를 알려주세요
              </p>
            </div>
          )}
        </>
      )}

      {error && <p className="mt-3 text-[13px] font-bold text-coral">{error}</p>}

      <div className="flex-1" />

      <div className="pt-6">
        {role === "student" ? (
          <Button
            variant="dark"
            disabled={busy || code.length !== 6}
            onClick={submitStudent}
          >
            {busy ? "확인하는 중…" : "책잇 시작하기"}
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
        <div className="mt-3 flex justify-center">
          <Chip tone="neutral">
            {role === "student" ? "학생 온보딩" : "교사 온보딩"}
          </Chip>
        </div>
      </div>
    </div>
  );
}
