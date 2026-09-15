/**
 * rewards — owner: 문민재
 *
 * 책갈피 원장, 열람권 교환, 알라딘 링크.
 *
 * 이 파일이 모듈의 유일한 public surface다.
 * 다른 모듈은 반드시 여기를 통해서만 import 한다 (CLAUDE.md §2).
 * 내부 구조: components/ · server/ · schema.ts
 *
 * 계획된 export (docs/spec.md §5):
 *   GET  /api/points                    → { balance, ledger[] }
 *   POST /api/points/exchange { kind }  → { balance, voucher_url }
 *
 * points_ledger 는 append-only다. 잔액 컬럼은 존재하지 않는다 — sum(delta)로 계산 (CLAUDE.md §4).
 * 적립은 verification 모듈이 record_verification_result RPC 로 한다 (0008).
 * 차감(교환)은 exchange_points RPC(0010, 초안)가 잔액 확인과 한 트랜잭션으로 한다.
 * UI 문구에서는 항상 "책갈피"라고 부른다 — "포인트"라고 쓰지 않는다 (CLAUDE.md §9).
 *
 * ⚠️ 서버 로직은 여기서 re-export 하지 않는다. Route Handler 는
 *    "@/modules/rewards/server" 를 직접 import 한다 (verification 모듈과 같은 이유).
 */

export { MeScreen } from "./components/MeScreen";

/** 요청 본문 스키마 + 표시 상수. 서버 전용이 아니라 화면과 라우트 양쪽에서 쓴다 */
export {
  exchangeSchema,
  EXCHANGE_COST,
  EXCHANGE_LABEL,
  REASON_LABEL,
} from "./schema";
