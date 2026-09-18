import assert from "node:assert/strict";
import { test } from "node:test";

import { createBreathTracker, createVoiceDetector, MAX_VOICED_RUN_MS } from "./breath";

/** 50ms 마다 한 번씩 넣는다. pattern 은 [목소리 ms, 조용 ms] 의 반복 */
function feed(pattern: Array<[number, number]>, totalMs: number): number[] {
  const tracker = createBreathTracker();
  const fired: number[] = [];
  let t = 0;
  while (t < totalMs) {
    for (const [voiceMs, quietMs] of pattern) {
      for (let s = 0; s < voiceMs && t < totalMs; s += 50, t += 50) if (tracker(t, true)) fired.push(t);
      for (let s = 0; s < quietMs && t < totalMs; s += 50, t += 50) if (tracker(t, false)) fired.push(t);
    }
  }
  return fired;
}

test("TTS 처럼 쉼표에서 0.1초씩만 끊고 15초를 읽으면 10초 넘어서 알린다 (실측 모양)", () => {
  const fired = feed([[1500, 100]], 15_000);
  assert.equal(fired.length, 1);
  assert.ok(fired[0] > MAX_VOICED_RUN_MS && fired[0] < MAX_VOICED_RUN_MS + 500);
});

test("사람처럼 4초 읽고 0.4초 숨 쉬기를 되풀이하면 1분을 읽어도 알리지 않는다", () => {
  assert.deepEqual(feed([[4000, 400]], 60_000), []);
});

test("느리게 또박또박 읽는 아이(1초 읽고 0.3초 쉼)도 걸리지 않는다", () => {
  assert.deepEqual(feed([[1000, 300]], 60_000), []);
});

test("알린 뒤에는 처음부터 다시 잰다 — 같은 구간으로 계속 울리지 않는다", () => {
  const fired = feed([[1500, 100]], 25_000);
  assert.equal(fired.length, 2);
  assert.ok(fired[1] - fired[0] > MAX_VOICED_RUN_MS);
});

test("목소리 판정은 조용한 바닥의 세 배를 넘을 때다 — 기기마다 크기가 달라도 된다", () => {
  const quietRoom = createVoiceDetector();
  for (let i = 0; i < 20; i += 1) quietRoom(0.002);
  assert.equal(quietRoom(0.003), false, "바닥 근처");
  assert.equal(quietRoom(0.02), true, "목소리");

  const loudMic = createVoiceDetector();
  for (let i = 0; i < 20; i += 1) loudMic(0.02);
  assert.equal(loudMic(0.03), false, "시끄러운 방의 바닥 근처");
  assert.equal(loudMic(0.2), true);
});
