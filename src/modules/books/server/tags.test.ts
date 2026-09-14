import assert from "node:assert/strict";
import { test } from "node:test";

import { mapToGenreTags } from "./tags";

test("카테고리 문자열에서 태그를 찾는다", () => {
  assert.deepEqual(mapToGenreTags("청소년 판타지 소설", null), ["판타지"]);
});

test("카테고리가 없으면 KDC 대분류로 대체한다", () => {
  assert.deepEqual(mapToGenreTags(null, "813.6"), ["성장소설"]);
});

test("아무 단서도 없으면 빈 배열", () => {
  assert.deepEqual(mapToGenreTags(null, null), []);
});

test("최대 4개까지만 반환한다", () => {
  const many = mapToGenreTags("판타지 SF 추리 동화 역사 모험", null);
  assert.ok(many.length <= 4);
});
