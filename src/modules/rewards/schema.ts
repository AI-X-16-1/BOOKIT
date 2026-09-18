/**
 * rewards 요청 검증 + 교환 상수 — docs/spec.md §4, §5.
 *
 * 소유: 문민재 (CLAUDE.md §3).
 */
import { z } from "zod";

import type { ExchangeKind, PointReason } from "@/shared/types";

/** POST /api/points/exchange */
export const exchangeSchema = z.object({
  kind: z.enum(["ebook", "audiobook"]),
});

/** 국회도서관 ebook 열람권 −300, 오디오북 −450 (docs/spec.md §4). 유일한 출처 — DB 는 이 값을 받아서 쓴다 */
export const EXCHANGE_COST: Record<ExchangeKind, number> = {
  ebook: 300,
  audiobook: 450,
};

export const EXCHANGE_REASON: Record<ExchangeKind, PointReason> = {
  ebook: "ebook_pass",
  audiobook: "audiobook_pass",
};

export const EXCHANGE_LABEL: Record<ExchangeKind, string> = {
  ebook: "국회도서관 ebook 열람권",
  audiobook: "오디오북 열람권",
};

/** 국회전자도서관 — 열람권은 코드가 아니라 이 포털에서 로그인 후 바로 쓴다 */
export const VOUCHER_URL = "https://dlps.nanet.go.kr/";

export const REASON_LABEL: Record<PointReason, string> = {
  verification_pass: "이해도 확인 통과",
  ebook_pass: "ebook 열람권",
  audiobook_pass: "오디오북 열람권",
  admin_adjust: "이전 학기 이월",
  // 0016 아이템 샵. enum 값이 늘어 컴파일용으로 김민경이 넣음 — 문구는 바꿔도 된다
  item_purchase: "아이템 구매",
};
