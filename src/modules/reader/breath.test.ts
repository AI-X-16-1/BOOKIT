import assert from "node:assert/strict";
import { test } from "node:test";

import { createBreathTracker, MAX_VOICED_RUN_MS } from "./breath";

/** everyMs 마다 새 낱말이 들어오고, runMs 마다 pauseMs 동안 쉰다 */
function feed(everyMs: number, runMs: number, pauseMs: number, totalMs: number): number[] {
  const tracker = createBreathTracker();
  const fired: number[] = [];
  let t = 0;
  while (t < totalMs) {
    for (let s = 0; s < runMs && t < totalMs; s += everyMs, t += everyMs) if (tracker(t)) fired.push(t);
    t += pauseMs;
  }
  return fired;
}

test("TTS 처럼 0.2초마다 새 낱말이 오고 쉼표에서 0.14초만 쉬면 10초 넘어서 알린다", () => {
  const fired = feed(200, 1500, 140, 15_000);
  assert.equal(fired.length, 1);
  assert.ok(fired[0] > MAX_VOICED_RUN_MS && fired[0] < MAX_VOICED_RUN_MS + 1000);
});

test("사람처럼 4초 읽고 숨 쉬면(새 낱말이 0.8초 안 옴) 1분을 읽어도 알리지 않는다", () => {
  assert.deepEqual(feed(300, 4000, 800, 60_000), []);
});

test("천천히 한 낱말씩 읽는 아이는 낱말 사이마다 숨으로 잡혀 걸리지 않는다", () => {
  assert.deepEqual(feed(900, 900, 0, 60_000), []);
});

test("알린 뒤에는 처음부터 다시 잰다", () => {
  const fired = feed(200, 1500, 140, 25_000);
  assert.equal(fired.length, 2);
  assert.ok(fired[1] - fired[0] > MAX_VOICED_RUN_MS);
});
