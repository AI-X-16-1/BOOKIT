/**
 * review 모듈 목 — 이제 남은 건 delay 하나다.
 *
 * 화면은 실제 Route Handler 로 돌고, 이 파일은 다른 모듈의 mock.ts
 * (books · teacher · rewards · reader · ranking · guardian · growth)가 가져다 쓰는
 * 가짜 지연만 남겼다. 그쪽 목이 전부 걷히면 이 파일도 지운다.
 */

/** 네트워크가 있는 것처럼 보이게 하는 지연. 로딩 상태를 실제로 확인하려고 둔다. */
export const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));
