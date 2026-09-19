import assert from "node:assert/strict";
import { test } from "node:test";

import { sentenceAround } from "./word-quiz";

const PASSAGE =
  "어느 해 몹시 추운 겨울날이었습니다.\n\n“돈 한 푼 줍시요! 돈 한 푼 줍시요!” 하고 애걸애걸하는 불쌍한 어린 거지가 하나 있었습니다. 사람들은 본 체도 않았습니다.";

test("sentenceAround — 원문 그대로의 문장을 잘라 온다 (모델이 따옴표를 바꿔 적어도)", () => {
  const hint = '"돈 한 푼 줍시요! 돈 한 푼 줍시요!" 하고 애걸애걸하는';
  assert.equal(
    sentenceAround(PASSAGE, "애걸애걸하는", hint),
    "“돈 한 푼 줍시요! 돈 한 푼 줍시요!” 하고 애걸애걸하는 불쌍한 어린 거지가 하나 있었습니다.",
  );
});

test("sentenceAround — 낱말 앞이 너무 짧으면 앞 문장까지 붙인다", () => {
  assert.equal(
    sentenceAround("“어머니, 어디 계셔요!” 하고 탄식을 하였습니다.", "탄식을"),
    "“어머니, 어디 계셔요!” 하고 탄식을 하였습니다.",
  );
});

test("sentenceAround — 지문에 없는 낱말이면 null", () => {
  assert.equal(sentenceAround(PASSAGE, "애원하는"), null);
});

test("sentenceAround — 긴 문장은 낱말 앞뒤만 남긴다", () => {
  const long = `${"가나다라마바사 ".repeat(12)}무성한 ${"아자차카타파하 ".repeat(12)}끝.`;
  const s = sentenceAround(long, "무성한");
  assert.ok(s && s.includes("무성한") && s.length <= 92 && s.startsWith("…") && s.endsWith("…"));
});
