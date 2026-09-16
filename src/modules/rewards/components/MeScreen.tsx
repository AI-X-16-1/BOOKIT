"use client";

import { useEffect, useState } from "react";
import type {
  ClassRankingResponse,
  GrowthResponse,
  MeResponse,
  PointsResponse,
} from "@/shared/types";
import { apiGet } from "@/shared/api/client";
import { Card } from "@/shared/ui";
import { GuardianShareCard } from "@/modules/guardian";
import { REASON_LABEL } from "../schema";

/**
 * 나 — 책갈피·읽은 책. 목업 4 #1 (L36-86).
 *
 * #38 진행 상황:
 *   - 책갈피 잔액/원장 — GET /api/points 로 연결 완료 (#30).
 *   - 우리 반 순위 — GET /api/ranking/class 로 연결 완료.
 *   - 연속 기록 — GET /api/growth 로 연결 완료 (#33 머지됨).
 *   - 이름·학반 — GET /api/profile 연결 완료 (#85 머지, #71).
 *
 * #58 결정: 국회도서관 ebook·오디오북 "열람권" 교환은 실제로 전달되는 게 없어(무료 열람권을
 * 발급할 방법이 없고, 대부분 초1~중3 은 국회도서관 이용 대상도 아니다) 교환 버튼을 뺐다.
 * API·원장(points_ledger)은 과거 기록 보존을 위해 그대로 둔다 — 새 소비처는 반 챌린지
 * 쪽으로 옮기기로 했다 (#58 논의, 로드맵).
 *
 * #71 결정: 레벨·뱃지 칩("Lv.4 꾸준한 독서가", "🏅 첫 책갈피")은 docs/spec.md 에 없는
 * 정적 데모 값이라 뺐다 — 독후감을 한 편도 안 쓴 계정에도 그대로 떴다 (GrowthSection.tsx 동일 결정).
 *
 * #71 (김민경 결정): 읽은 책(완독 점수 목록)은 제출 전엔 조회 API 를 안 만들기로 했다.
 * 고정 목록 대신 빈 상태로 둔다.
 *
 * #81: POST /api/guardian/link 는 이미 구현돼 있었는데 부르는 화면이 없었다.
 * GuardianShareCard 가 그 자리다.
 */
export function MeScreen() {
  const [profile, setProfile] = useState<MeResponse | null>(null);
  const [points, setPoints] = useState<PointsResponse | null>(null);
  const [rank, setRank] = useState<ClassRankingResponse | null>(null);
  const [growth, setGrowth] = useState<GrowthResponse | null>(null);
  const [note, setNote] = useState<string | null>(null);

  useEffect(() => {
    apiGet<MeResponse>("/api/profile").then(setProfile).catch(() => {});
    apiGet<PointsResponse>("/api/points").then(setPoints).catch(() => {
      setNote("책갈피를 불러오지 못했어.");
    });
    apiGet<ClassRankingResponse>("/api/ranking/class")
      .then(setRank)
      .catch(() => {});
    apiGet<GrowthResponse>("/api/growth")
      .then(setGrowth)
      .catch(() => {});
  }, []);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3.5">
        <div className="flex h-14 w-14 flex-none items-center justify-center rounded-full bg-yellow text-xl font-bold text-stamp-text">
          {profile ? profile.display_name[0] : "—"}
        </div>
        <div className="text-xl font-bold text-ink">
          {profile
            ? profile.class_label
              ? `${profile.display_name} · ${profile.class_label}`
              : profile.display_name
            : "—"}
        </div>
      </div>

      <div className="rounded-card bg-panel p-5">
        <div className="text-[13px] text-on-dark-2">모은 책갈피</div>
        <div className="mt-1.5 text-[34px] leading-none font-bold text-on-dark">
          {points ? points.balance.toLocaleString() : "—"}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2.5">
        <Card>
          <div className="text-[13px] text-muted">연속 기록 🔥</div>
          <div className="mt-1.5 text-[26px] font-bold text-ink">
            {growth ? `${growth.streak.current_days}일` : "—"}
          </div>
        </Card>
        <Card>
          <div className="text-[13px] text-muted">우리 반 순위</div>
          <div className="mt-1.5 text-[26px] font-bold text-coral">
            {rank ? `${rank.my_class.rank}위` : "—"}
          </div>
        </Card>
      </div>

      <Card>
        <div className="text-[13px] text-muted">읽은 책</div>
        <p className="mt-2 text-sm text-muted">독후감을 통과하면 여기 모여.</p>
      </Card>

      {/* #58: 국회도서관 열람권 교환은 실제로 전달되는 게 없어 뺐다 — 준비 중 안내만 남긴다 */}
      <div className="rounded-card bg-yellow-bg p-4">
        <div className="text-[13px] text-yellow-text-2">책갈피 교환하기</div>
        <p className="mt-2 text-sm text-yellow-text">
          열람권 교환은 아직 준비 중이야. 모은 책갈피는 책나무를 키우고 우리 반 순위를
          올리는 데 쓰이고 있어!
        </p>
        {note && (
          <p className="mt-3 text-center text-[13px] text-yellow-text">{note}</p>
        )}
      </div>

      {/* #81: 발급 API는 있었는데 부르는 화면이 없었다 */}
      <GuardianShareCard />

      {/* 원장 — append-only 라 차감도 한 줄로 쌓인다 */}
      <Card>
        <div className="text-[13px] text-muted">책갈피 기록</div>
        <div className="mt-1">
          {points?.ledger.map((row) => (
            <div
              key={row.id}
              className="flex items-center gap-3 border-b border-border-soft py-2.5 text-sm last:border-b-0"
            >
              <span className="flex-1 truncate text-ink">
                {REASON_LABEL[row.reason] ?? row.reason}
              </span>
              <span
                className={`font-bold ${row.delta > 0 ? "text-green" : "text-coral"}`}
              >
                {row.delta > 0 ? "+" : ""}
                {row.delta}
              </span>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
