import assert from "node:assert/strict";
import { test } from "node:test";

import { badRequest, fail, ok, unauthorized } from "./response";

test("ok는 200과 data 봉투를 돌려준다", async () => {
  const res = ok({ hello: "world" });
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { data: { hello: "world" } });
});

test("fail은 지정한 status와 error 봉투를 돌려준다", async () => {
  const res = fail("some_code", "메시지", 503);
  assert.equal(res.status, 503);
  assert.deepEqual(await res.json(), {
    error: { code: "some_code", message: "메시지" },
  });
});

test("unauthorized는 401", async () => {
  const res = unauthorized();
  assert.equal(res.status, 401);
});

test("badRequest는 400", async () => {
  const res = badRequest("bad", "잘못됐어");
  assert.equal(res.status, 400);
});
