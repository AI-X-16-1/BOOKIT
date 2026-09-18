/**
 * reader/breath — 숨 쉴 틈 없이 이어지는 낭독을 알아챈다. owner: 강민구
 *
 * 소리 내어 읽기(STT)는 아이 목소리 대신 **TTS 로 틀어도** 형광펜이 따라간다. 사람은
 * 숨을 쉬어야 해서 몇 초마다 끊기는데, TTS 는 문장 안에서 거의 쉬지 않는다.
 *
 * 실측 (2026-09-18, Windows 한국어 TTS "Heami" 로 「참된 동정」 첫 문단 26초):
 *   - 진짜 쉼은 문장 끝 두 번뿐 (1.08초 · 0.8초)
 *   - 쉼표에서도 0.14초 이하로만 끊고, 긴 둘째 문장을 **15초 내리** 읽었다
 * 그래서:
 *   - 0.25초 이상 조용하면 "숨" 으로 친다 — TTS 의 쉼표 쉼보다 길고 사람 숨보다 짧다
 *   - 숨 없이 10초 넘게 소리가 이어지면 "숨 없음" — TTS 15초는 걸리고 아이는 여유가 있다
 *
 * 한계: 문장이 짧은 글을 TTS 가 읽으면 마침표마다 쉬어서 빠져나갈 수 있다. 판별이 아니라
 * "숨 없이 줄줄 읽는 것" 을 막는 장치다.
 *
 * 순수 함수만 둔다. 마이크 소리 크기는 useReadAloud 가 브라우저 안에서 재서 넘긴다 —
 * 소리 자체는 어디에도 보내거나 남기지 않는다.
 */

/** 이만큼 조용하면 숨을 쉰 것으로 본다 */
export const BREATH_PAUSE_MS = 250;

/** 숨 없이 이만큼 넘게 소리가 이어지면 사람이 읽은 게 아니라고 본다 */
export const MAX_VOICED_RUN_MS = 10_000;

/**
 * 소리 크기(RMS) → 목소리인가. 기기마다 마이크 크기가 달라서 고정 기준을 못 쓴다.
 * 가장 조용했던 수준(바닥)을 따라가며, 바닥의 3배(약 +10dB)를 넘으면 목소리로 본다.
 * 바닥은 더 조용한 소리가 오면 바로 내려가고, 아니면 천천히 올라간다 —
 * 방이 시끄러워지면 몇 초 안에 따라 올라간다.
 */
export function createVoiceDetector(): (rms: number) => boolean {
  let floor = Number.POSITIVE_INFINITY;
  return (rms) => {
    floor = rms < floor ? rms : floor * 1.005;
    return rms > Math.max(floor * 3, 0.004);
  };
}

/**
 * 시각과 목소리 여부를 받아, 숨 없이 너무 오래 이어졌으면 true 를 한 번 돌려준다.
 * true 를 돌려준 뒤에는 처음부터 다시 잰다 (같은 구간으로 계속 울리지 않게).
 * BREATH_PAUSE_MS 보다 짧은 끊김은 이어진 것으로 본다 — TTS 는 쉼표에서 그만큼만 끊는다.
 */
export function createBreathTracker(): (now: number, voiced: boolean) => boolean {
  let runStart: number | null = null;
  let silentSince: number | null = null;
  return (now, voiced) => {
    if (voiced) {
      silentSince = null;
      if (runStart === null) runStart = now;
      if (now - runStart > MAX_VOICED_RUN_MS) {
        runStart = null;
        return true;
      }
      return false;
    }
    if (silentSince === null) silentSince = now;
    if (now - silentSince >= BREATH_PAUSE_MS) runStart = null;
    return false;
  };
}
