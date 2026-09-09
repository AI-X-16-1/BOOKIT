"use client";

import { useEffect, useState } from "react";
import type {
  TeacherClassResponse,
  TeacherRankingResponse,
  TeacherStudentsResponse,
} from "@/shared/types";
import { Card, Chip } from "@/shared/ui";
import { WEEKLY_CONTRIB, getClass, getRanking, getStudents } from "../mock";

/**
 * 교사 대시보드. 목업 5 #1 (docs/mockups/5 관리자 대시보드 (웹).dc.html L47-112).
 *
 * 데스크톱 전용이다 (1024px+). 모바일 레이아웃은 만들지 않는다 (CLAUDE.md §8).
 * 1024px 미만에서는 안내만 띄운다.
 *
 * 화면 어디에도 독후감 본문이 없다. 점수·통과 여부·완료 건수만 본다 (CLAUDE.md §5).
 */
export function TeacherDashboard() {
  const [cls, setCls] = useState<TeacherClassResponse | null>(null);
  const [rank, setRank] = useState<TeacherRankingResponse | null>(null);
  const [students, setStudents] = useState<TeacherStudentsResponse | null>(null);

  useEffect(() => {
    getClass().then(setCls);
    getRanking().then(setRank);
    getStudents().then(setStudents);
  }, []);

  const top = rank?.rows[0]?.verified_count ?? 1;
  const mine = rank?.rows.find((r) => r.class_id === "d2");

  return (
    <>
      {/* 1024px 미만 — 안내만 */}
      <div className="flex min-h-dvh items-center justify-center px-6 lg:hidden">
        <Card className="max-w-sm text-center">
          <div className="text-[17px] font-bold text-ink">
            선생님 화면은 데스크톱에서 열어주세요
          </div>
          <p className="mt-2 text-sm leading-relaxed text-muted">
            반 전체를 한눈에 보려면 넓은 화면이 필요해요. 1024px 이상에서 열면
            대시보드가 나타납니다.
          </p>
        </Card>
      </div>

      <div className="hidden min-h-dvh flex-col gap-[18px] px-8 py-7 lg:flex">
        <div className="flex items-end justify-between gap-5">
          <div>
            <h1 className="text-[22px] font-bold text-ink">한빛초 반 대항전</h1>
            <p className="mt-1.5 text-[13px] text-muted">
              AI 검증을 통과한 독후감만 집계돼요 · 9월 1주차
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Chip tone="dark">우리 학교</Chip>
            <Chip tone="neutral">전국</Chip>
            {cls && (
              <Chip tone="yellow">참여 코드 {cls.join_code}</Chip>
            )}
          </div>
        </div>

        {/* 요약 3칸 */}
        <div className="grid grid-cols-3 gap-3.5">
          <Card>
            <div className="text-xs text-muted">우리 반 포인트</div>
            <div className="mt-1.5 text-[28px] font-bold text-ink">
              {mine ? mine.verified_count.toLocaleString() : "—"}
            </div>
          </Card>
          <Card>
            <div className="text-xs text-muted">통과 건수</div>
            <div className="mt-1.5 text-[28px] font-bold text-ink">
              {cls ? `${cls.stats.completed_count}건` : "—"}
            </div>
          </Card>
          <div className="rounded-[14px] bg-panel p-5">
            <div className="text-xs text-on-dark-2">1위까지</div>
            <div className="mt-1.5 text-[28px] font-bold text-coral-light">
              {rank && mine ? `${(top - mine.verified_count).toLocaleString()}점` : "—"}
            </div>
          </div>
        </div>

        <div className="grid flex-1 grid-cols-[1.25fr_1fr] gap-4">
          {/* 반 순위 */}
          <Card className="p-[22px]">
            <div className="text-[13px] text-muted">반 순위</div>
            <div className="mt-2">
              {rank?.rows.map((row) => {
                const isMine = row.class_id === "d2";
                return (
                  <div
                    key={row.class_id}
                    className={`flex items-center gap-3.5 border-b border-border-soft py-3.5 last:border-b-0 ${isMine ? "rounded-lg bg-coral-bg px-1.5" : ""}`}
                  >
                    <span
                      className={`w-[22px] text-[15px] font-bold ${isMine ? "text-coral" : "text-faint"}`}
                    >
                      {row.rank}
                    </span>
                    <span
                      className={`flex-1 truncate text-[15px] font-bold ${isMine ? "text-coral" : "text-ink"}`}
                    >
                      {row.label}
                      {isMine && " (우리반)"}
                    </span>
                    <span className="h-2 w-[180px] flex-none rounded-full bg-border-soft">
                      <span
                        className={`block h-2 rounded-full ${row.rank === 1 ? "bg-green" : isMine ? "bg-coral" : "bg-rank-bar"}`}
                        style={{
                          width: `${Math.round((row.verified_count / top) * 100)}%`,
                        }}
                      />
                    </span>
                    <span
                      className={`w-14 flex-none text-right text-sm ${isMine ? "font-bold text-coral" : "text-ink-soft"}`}
                    >
                      {row.verified_count.toLocaleString()}
                    </span>
                  </div>
                );
              })}
            </div>
          </Card>

          <div className="flex flex-col gap-4">
            <div className="rounded-card bg-yellow-bg p-[22px]">
              <div className="text-[13px] text-yellow-text-2">
                우리 반 이번 주 기여
              </div>
              <div className="mt-3">
                {WEEKLY_CONTRIB.map((s, i) => (
                  <div key={s.name} className="flex items-center gap-2.5 py-2">
                    <div
                      className={`flex h-[26px] w-[26px] flex-none items-center justify-center rounded-full text-[11px] font-bold ${i === 0 ? "bg-yellow text-stamp-text" : "bg-sheet-handle text-yellow-text"}`}
                    >
                      {s.name[0]}
                    </div>
                    <span
                      className={`flex-1 text-sm ${i === 0 ? "font-bold text-ink" : "text-ink-soft"}`}
                    >
                      {s.name}
                    </span>
                    <span className="text-[13px] text-yellow-text">
                      {s.points}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <Card className="p-[22px]">
              <div className="text-[13px] text-muted">집계 방식</div>
              <p className="mt-2.5 text-sm leading-[1.8] text-ink-soft">
                · AI 검증 통과 건만 합산
                <br />· 통과 1건 = 기본 50점
                <br />· 재작성 통과도 동일 인정
                <br />· 인증샷·자기 신고 없음
              </p>
            </Card>
          </div>
        </div>

        {/* 학생별 진도 — 본문은 없다 */}
        <Card className="p-[22px]">
          <div className="flex items-baseline justify-between">
            <div className="text-[13px] text-muted">학생별 진도</div>
            <div className="text-xs text-faint">
              독후감 본문은 학생 본인만 볼 수 있어요
            </div>
          </div>
          <table className="mt-3 w-full text-left">
            <thead>
              <tr className="text-xs text-muted">
                <th className="py-2 font-normal">이름</th>
                <th className="py-2 font-normal">통과</th>
                <th className="py-2 font-normal">평균 이해도</th>
                <th className="py-2 font-normal">연속</th>
                <th className="py-2 font-normal">마지막 활동</th>
              </tr>
            </thead>
            <tbody>
              {students?.rows.map((r) => (
                <tr
                  key={r.student_id}
                  className="border-t border-border-soft text-[15px] text-ink"
                >
                  <td className="py-2.5 font-bold">{r.name}</td>
                  <td className="py-2.5">{r.passed_count}건</td>
                  <td className="py-2.5 text-green">{r.avg_score}점</td>
                  <td className="py-2.5">
                    {r.streak > 0 ? `${r.streak}일 🔥` : "—"}
                  </td>
                  <td className="py-2.5 text-sm text-muted">
                    {r.last_active?.slice(5, 10).replace("-", "/") ?? "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </div>
    </>
  );
}
