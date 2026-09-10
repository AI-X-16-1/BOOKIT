/**
 * rewards 모듈 목 데이터. ⚠️ 임시 — 실제 API 가 붙으면 지운다.
 *
 * 원장은 append-only 다. 잔액 컬럼은 없고 sum(delta) 로 계산한다 (CLAUDE.md §4).
 * 여기서도 같은 방식으로 계산해서, 나중에 실제 API 로 바꿔도 화면이 그대로 맞게 한다.
 */
import type {
  ExchangeKind,
  ExchangeResponse,
  PointsLedgerView,
  PointsResponse,
} from "@/shared/types";
import { delay } from "@/modules/review";

/** 교환 비용 (docs/spec.md §4). */
export const EXCHANGE_COST: Record<ExchangeKind, number> = {
  ebook: 300,
  audiobook: 450,
};

export const EXCHANGE_LABEL: Record<ExchangeKind, string> = {
  ebook: "국회도서관 ebook 열람권",
  audiobook: "오디오북 열람권",
};

const SEED_LEDGER: PointsLedgerView[] = [
  { id: "l1", delta: 1390, reason: "admin_adjust", created_at: "2026-07-26T09:00:00Z" },
  { id: "l2", delta: 50, reason: "verification_pass", created_at: "2026-09-01T09:00:00Z" },
  { id: "l3", delta: 50, reason: "verification_pass", created_at: "2026-09-04T09:00:00Z" },
  { id: "l4", delta: 50, reason: "verification_pass", created_at: "2026-09-07T09:00:00Z" },
  { id: "l5", delta: -300, reason: "ebook_pass", created_at: "2026-09-08T09:00:00Z" },
];

/** 세션 동안만 유지되는 원장. 새로고침하면 시드 상태로 돌아간다. */
let ledger: PointsLedgerView[] = [...SEED_LEDGER];

export const balanceOf = (rows: PointsLedgerView[]) =>
  rows.reduce((sum, r) => sum + r.delta, 0);

/** GET /api/points */
export async function getPoints(): Promise<PointsResponse> {
  await delay(200);
  return { balance: balanceOf(ledger), ledger: [...ledger].reverse() };
}

/**
 * POST /api/points/exchange
 * 잔액이 모자라면 계약대로 에러를 던진다 — 화면에서 실패 경로도 볼 수 있게.
 */
export async function exchange(kind: ExchangeKind): Promise<ExchangeResponse> {
  await delay(600);
  const cost = EXCHANGE_COST[kind];
  if (balanceOf(ledger) < cost) {
    throw new Error("INSUFFICIENT_POINTS");
  }
  ledger = [
    ...ledger,
    {
      id: `l${ledger.length + 1}`,
      delta: -cost,
      reason: kind === "ebook" ? "ebook_pass" : "audiobook_pass",
      created_at: new Date().toISOString(),
    },
  ];
  return {
    balance: balanceOf(ledger),
    voucher_url: "https://dlps.nanet.go.kr/",
  };
}

export const REASON_LABEL: Record<string, string> = {
  verification_pass: "이해도 확인 통과",
  ebook_pass: "ebook 열람권",
  audiobook_pass: "오디오북 열람권",
  admin_adjust: "이전 학기 이월",
};
