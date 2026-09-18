/**
 * reader/breath — 숨 쉴 틈 없이 이어지는 낭독을 알아챈다. owner: 강민구
 *
 * 소리 내어 읽기(STT)는 아이 목소리 대신 **TTS 로 틀어도** 형광펜이 따라간다. 사람은
 * 숨을 쉬어야 해서 몇 초마다 끊기는데, TTS 는 문장 안에서 거의 쉬지 않는다.
 *
 * 실측 (2026-09-18, Windows 한국어 TTS "Heami" 로 「참된 동정」 첫 문단 26초):
 *   - 진짜 쉼은 문장 끝 두 번뿐 (1.08초 · 0.8초)
 *   - 쉼표에서도 0.14초 이하로만 끊고, 긴 둘째 문장을 **15초 내리** 읽었다
 *
 * 재는 방법이 기기에 따라 둘이다 (useReadAloud 가 고른다):
 *
 * 1. **PC — 마이크 소리 크기** (createVoiceDetector + createLevelBreathTracker).
 *    0.25초 이상 조용하면 숨. 가장 정확하다. 진짜 크롬 + 구글 인식에 TTS 녹음을 넣어
 *    23초에 초기화, 사람처럼 쉬며 읽은 녹음·배경 소음 섞은 녹음은 초기화 0회.
 *
 * 2. **폰 — 인식 결과에 새 낱말이 들어온 시각** (createWordBreathTracker).
 *    폰에서는 마이크를 따로 열면 안 된다. 안드로이드의 음성 인식은 구글 앱이 마이크를
 *    잡아서, 크롬이 하나 더 열면 인식기가 소리를 못 받았다 (폰 실기기, 9/18: 목소리도
 *    인식이 안 됐다). 그래서 이미 오는 결과만 본다. 실측에서 인식기는 말하는 중에도
 *    새 낱말을 평균 0.58초 간격, 묶어서 보낼 땐 0.7초 넘게 띄워 보냈다 — 그래서
 *    새 낱말이 **1초** 넘게 안 오면 숨으로 본다. 네트워크가 늦어도 "숨" 으로 잡히는
 *    쪽이라, 틀려도 TTS 를 놓치는 쪽이지 아이를 억울하게 초기화하는 쪽이 아니다.
 *
 * 공통: 숨 없이 10초 넘게 이어지면 "숨 없음". 판별이 아니라 "숨 없이 줄줄 읽는 것" 을
 * 막는 장치다 — 문장이 짧은 글을 TTS 가 읽으면 마침표마다 쉬어서 빠져나갈 수 있다.
 */

/** 숨 없이 이만큼 넘게 이어지면 사람이 읽은 게 아니라고 본다 */
export const MAX_VOICED_RUN_MS = 10_000;

/** (PC) 이만큼 조용하면 숨을 쉰 것으로 본다. TTS 의 쉼표 쉼(0.14초)보다 길다 */
export const BREATH_PAUSE_MS = 250;

/** (폰) 새 낱말이 이만큼 안 들어오면 숨을 쉰 것으로 본다. 인식기의 묶음 간격보다 길다 */
export const NEW_WORD_GAP_MS = 1000;

/**
 * (PC) 소리 크기(RMS) → 목소리인가. 기기마다 마이크 크기가 달라 고정 기준을 못 쓴다.
 * 가장 조용했던 수준(바닥)을 따라가며, 바닥의 3배(약 +10dB)를 넘으면 목소리로 본다.
 * 바닥은 더 조용한 소리가 오면 바로 내려가고, 아니면 천천히 올라간다.
 */
export function createVoiceDetector(): (rms: number) => boolean {
  let floor = Number.POSITIVE_INFINITY;
  return (rms) => {
    floor = rms < floor ? rms : floor * 1.005;
    return rms > Math.max(floor * 3, 0.004);
  };
}

/**
 * (PC) 50ms 마다 시각과 목소리 여부를 넣는다. 숨 없이 너무 오래 이어졌으면 true 를
 * 한 번 돌려주고 처음부터 다시 잰다. BREATH_PAUSE_MS 보다 짧은 끊김은 이어진 것으로 본다.
 */
export function createLevelBreathTracker(): (now: number, voiced: boolean) => boolean {
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

/**
 * (폰) 새 낱말이 들어올 때마다 그 시각을 넣는다. 숨 없이 너무 오래 이어졌으면 true 를
 * 한 번 돌려주고 처음부터 다시 잰다.
 */
export function createWordBreathTracker(): (now: number) => boolean {
  let runStart: number | null = null;
  let last: number | null = null;
  return (now) => {
    if (last === null || runStart === null || now - last > NEW_WORD_GAP_MS) runStart = now;
    last = now;
    if (now - runStart > MAX_VOICED_RUN_MS) {
      runStart = null;
      return true;
    }
    return false;
  };
}
