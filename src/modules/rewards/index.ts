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
 * 적립/차감은 verification·교환 행과 같은 트랜잭션 안에서 처리한다.
 * 같은 verification.id 로 두 번 적립되지 않게 (reason, ref_id) 유니크 인덱스가 막아준다.
 * UI 문구에서는 항상 "책갈피"라고 부른다 — "포인트"라고 쓰지 않는다 (CLAUDE.md §9).
 */
export {};
