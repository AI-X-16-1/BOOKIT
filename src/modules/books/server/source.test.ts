import assert from "node:assert/strict";
import { test } from "node:test";

import { mockSource, selectSourceKind } from "./source";

test("키가 하나도 없으면 mock", () => {
  assert.equal(selectSourceKind({}), "mock");
});

test("NLK_API_KEY가 있으면 nlk 우선", () => {
  assert.equal(
    selectSourceKind({ NLK_API_KEY: "x", DATA_GO_KR_KEY: "y" }),
    "nlk",
  );
});

test("DATA_GO_KR_KEY만 있으면 data_go_kr", () => {
  assert.equal(selectSourceKind({ DATA_GO_KR_KEY: "y" }), "data_go_kr");
});

test("mockSource는 제목/저자로 찾는다", async () => {
  const hits = await mockSource.search("아몬드");
  assert.equal(hits.length, 1);
  assert.equal(hits[0].title, "아몬드");
  assert.equal(hits[0].isbn13, "9788936434267");
});

test("mockSource는 빈 검색어에 빈 배열", async () => {
  assert.deepEqual(await mockSource.search("   "), []);
});
