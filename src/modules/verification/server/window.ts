/**
 * verification/server/window — 답변 제한 시간. owner: 박재경
 *
 * 화면의 카운트다운은 표시용이다. 진실의 원천은 verifications.asked_at 과
 * answered_at 이고, 늦게 도착한 답을 걸러내는 판단은 전부 서버에서 한다
 * (docs/spec.md §5).
 */
import "server-only";

/** docs/spec.md §6 — 기본 45, 허용 30-60 */
const DEFAULT_SECONDS = 45;
const MIN_SECONDS = 30;
const MAX_SECONDS = 60;

/**
 * 네트워크 지연과 화면 렌더 사이의 오차를 덮는 여유 (docs/spec.md §5).
 * 이 여유가 없으면 제한 시간에 딱 맞춰 낸 답이 왕복 지연 때문에 시간 초과로 죽는다.
 */
export const GRACE_SECONDS = 5;

/**
 * 시연 직전에 조정할 수 있어야 한다 (CLAUDE.md §6).
 * 범위를 벗어나거나 숫자가 아니면 기본값으로 떨어뜨린다 — 심사위원 앞에서
 * 오타 하나로 타이머가 0초가 되는 것이 가장 나쁜 결과다.
 */
export function answerWindowSeconds(): number {
  const raw = process.env.ANSWER_WINDOW_SEC?.trim();
  if (!raw) return DEFAULT_SECONDS;

  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed < MIN_SECONDS || parsed > MAX_SECONDS) {
    console.warn(
      `[verification] ANSWER_WINDOW_SEC=${raw} 는 ${MIN_SECONDS}-${MAX_SECONDS} 범위 밖이다. ${DEFAULT_SECONDS} 로 간다.`,
    );
    return DEFAULT_SECONDS;
  }

  return parsed;
}

/** 통과 시 지급할 책갈피. 잘못된 값이면 spec §4 의 50 으로 돌아간다. */
export function pointsPerPass(): number {
  const raw = process.env.POINTS_PER_PASS?.trim();
  if (!raw) return 50;

  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed < 0) {
    console.warn(`[verification] POINTS_PER_PASS=${raw} 를 모르겠다. 50 으로 간다.`);
    return 50;
  }

  return parsed;
}

/**
 * asked_at 으로부터 제한 시간 + 여유를 넘겼는가.
 *
 * 넘겼다고 해서 요청을 튕기지는 않는다 — 시간 초과도 하나의 실패한 시도로
 * 기록해야 재시도 흐름이 이어진다. 판단은 gradeAnswer 가 한다.
 */
export function isExpired(askedAt: string, now: Date = new Date()): boolean {
  const deadline =
    new Date(askedAt).getTime() + (answerWindowSeconds() + GRACE_SECONDS) * 1000;
  return now.getTime() > deadline;
}
