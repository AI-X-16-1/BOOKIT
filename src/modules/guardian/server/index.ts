/**
 * guardian/server — server-only barrel. owner: 문민재
 *
 * Route Handler 전용. summary.ts 가 "server-only" 를 import 하므로
 * 클라이언트 컴포넌트(GuardianView)가 쓰는 "@/modules/guardian" 와 한 배럴에
 * 묶지 않는다 — 묶는 순간 클라이언트 번들에 섞여 빌드가 깨진다
 * (verification, reader, rewards 모듈과 같은 이유).
 */
export { createGuardianLink } from "./link";
export { getGuardianSummary } from "./summary";
export type { GuardianResult } from "./result";
