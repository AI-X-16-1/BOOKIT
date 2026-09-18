import assert from "node:assert/strict";
import { test } from "node:test";

import {
  createLevelBreathTracker,
  createVoiceDetector,
  createWordBreathTracker,
  MAX_VOICED_RUN_MS,
} from "./breath";

/* ── PC: 소리 크기 ── */

/** 50ms 마다. pattern 은 [목소리 ms, 조용 ms] 의 반복 */
function feedLevel(pattern: Array<[number, number]>, totalMs: number): number[] {
  const tracker = createLevelBreathTracker();
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

test("PC — TTS 처럼 쉼표에서 0.1초만 끊고 15초를 읽으면 10초 넘어서 알린다 (실측 모양)", () => {
  const fired = feedLevel([[1500, 100]], 15_000);
  assert.equal(fired.length, 1);
  assert.ok(fired[0] > MAX_VOICED_RUN_MS && fired[0] < MAX_VOICED_RUN_MS + 500);
});

test("PC — 사람처럼 4초 읽고 0.4초 숨 쉬기를 되풀이하면 1분을 읽어도 알리지 않는다", () => {
  assert.deepEqual(feedLevel([[4000, 400]], 60_000), []);
});

test("PC — 목소리 판정은 조용한 바닥의 세 배를 넘을 때다", () => {
  const quiet = createVoiceDetector();
  for (let i = 0; i < 20; i += 1) quiet(0.002);
  assert.equal(quiet(0.003), false);
  assert.equal(quiet(0.02), true);
  const loud = createVoiceDetector();
  for (let i = 0; i < 20; i += 1) loud(0.02);
  assert.equal(loud(0.03), false);
  assert.equal(loud(0.2), true);
});

/* ── 폰: 새 낱말 간격 ── */

/** everyMs 마다 새 낱말, runMs 마다 pauseMs 쉼 */
function feedWords(everyMs: number, runMs: number, pauseMs: number, totalMs: number): number[] {
  const tracker = createWordBreathTracker();
  const fired: number[] = [];
  let t = 0;
  while (t < totalMs) {
    for (let s = 0; s < runMs && t < totalMs; s += everyMs, t += everyMs) if (tracker(t)) fired.push(t);
    t += pauseMs;
  }
  return fired;
}

test("폰 — 실측처럼 0.58초 간격으로 새 낱말이 쉬지 않고 오면 10초 넘어서 알린다", () => {
  const fired = feedWords(580, 15_000, 0, 15_000);
  assert.equal(fired.length, 1);
});

test("폰 — 인식기가 가끔 0.9초씩 묶어 보내도 숨으로 치지 않는다", () => {
  // 0.58초 간격 사이에 0.9초 틈이 섞여도 이어진 것으로 본다
  const fired = feedWords(580, 3000, 320, 15_000);
  assert.equal(fired.length, 1);
});

test("폰 — 사람처럼 숨 쉬면(새 낱말이 1.2초 안 옴) 1분을 읽어도 알리지 않는다", () => {
  assert.deepEqual(feedWords(580, 4000, 1200, 60_000), []);
});

test("알린 뒤에는 처음부터 다시 잰다", () => {
  const fired = feedWords(580, 30_000, 0, 25_000);
  assert.equal(fired.length, 2);
});
