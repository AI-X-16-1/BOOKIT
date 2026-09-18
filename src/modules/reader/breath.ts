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
 * **마이크를 따로 열지 않는다.** 처음엔 마이크 소리 크기를 직접 쟀는데, 안드로이드
 * 크롬에서 목소리 인식까지 멈췄다 (폰 실기기, 9/18). 안드로이드의 음성 인식은 구글 앱이
 * 마이크를 잡는데, 크롬이 마이크를 하나 더 열면 한쪽만 소리를 받는다.
 * 그래서 인식기가 이미 보내 주는 결과로 잰다 — **새 낱말이 들어온 시각**만 본다:
 *   - 새 낱말이 NEW_WORD_GAP_MS 넘게 안 들어오면 숨을 쉰 것으로 본다
 *   - 숨 없이 MAX_VOICED_RUN_MS 넘게 새 낱말이 이어지면 "숨 없음"
 *
 * 틀리는 방향이 중요하다. 네트워크가 잠깐 늦어 결과가 끊겨도 "숨" 으로 잡힐 뿐이라,
 * 틀려도 TTS 를 놓치는 쪽이지 **아이를 억울하게 초기화하는 쪽이 아니다.**
 * 한계: 문장이 짧은 글을 TTS 가 읽으면 마침표마다 쉬어서 빠져나갈 수 있다.
 */

/** 새 낱말이 이만큼 안 들어오면 숨을 쉰 것으로 본다. TTS 의 쉼표 쉼(0.14초)보다 한참 길다 */
export const NEW_WORD_GAP_MS = 700;

/** 숨 없이 이만큼 넘게 새 낱말이 이어지면 사람이 읽은 게 아니라고 본다 */
export const MAX_VOICED_RUN_MS = 10_000;

/**
 * 새 낱말이 들어올 때마다 그 시각을 넣는다. 숨 없이 너무 오래 이어졌으면 true 를
 * 한 번 돌려주고, 그 뒤로는 처음부터 다시 잰다 (같은 구간으로 계속 울리지 않게).
 */
export function createBreathTracker(): (now: number) => boolean {
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
