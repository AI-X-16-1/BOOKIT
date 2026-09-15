import assert from "node:assert/strict";
import { test } from "node:test";

import { parseBookId, parseSearchQuery } from "./schema";

test("parseSearchQuery는 앞뒤 공백을 지운다", () => {
  assert.equal(parseSearchQuery("  아몬드  "), "아몬드");
});

test("parseSearchQuery는 null이면 빈 문자열", () => {
  assert.equal(parseSearchQuery(null), "");
});

test("parseBookId는 uuid 형식만 통과시킨다", () => {
  assert.equal(parseBookId("not-a-uuid"), null);
  assert.equal(
    parseBookId("123e4567-e89b-12d3-a456-426614174000"),
    "123e4567-e89b-12d3-a456-426614174000",
  );
});

test("parseBookId는 undefined면 null", () => {
  assert.equal(parseBookId(undefined), null);
});
