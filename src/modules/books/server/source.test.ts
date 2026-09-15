import assert from "node:assert/strict";
import { test } from "node:test";

import { mockSource, selectSourceKind, toRawBookHitFromNlk } from "./source";

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

/**
 * 아래 두 테스트의 입력은 2026-09-15에 실제 NLK_API_KEY로
 * https://seoji.nl.go.kr/landingPage/SearchApi.do 를 호출해 받은 실제 응답을
 * 그대로 옮긴 것이다 (title=아몬드, title=어린 왕자 검색 결과 각 1건).
 */
test("toRawBookHitFromNlk는 빈 문자열 필드를 null로 정규화한다", () => {
  const hit = toRawBookHitFromNlk({
    PUBLISHER: "창비",
    AUTHOR: "지은이: 손원평",
    TITLE: "아몬드",
    EA_ISBN: "9788936456788",
    TITLE_URL: "",
    SUBJECT: "",
    KDC: "",
  });
  assert.deepEqual(hit, {
    isbn13: "9788936456788",
    title: "아몬드",
    author: "손원평",
    publisher: "창비",
    coverUrl: null,
    rawCategory: null,
    kdc: null,
  });
});

test("toRawBookHitFromNlk는 첫 역할 라벨만 벗겨내고 나머지 공역자 표기는 남긴다", () => {
  const hit = toRawBookHitFromNlk({
    PUBLISHER: "(주식회사)좋은땅",
    AUTHOR: "원작자 :  앙투안 드 생텍쥐페리;역자 :  홍희숙;",
    TITLE: "어린왕자 요약",
    EA_ISBN: "9791166496103",
    TITLE_URL: "",
    SUBJECT: "",
    KDC: "",
  });
  assert.equal(hit?.author, "앙투안 드 생텍쥐페리;역자 :  홍희숙;");
});

test("toRawBookHitFromNlk는 title이나 author가 없으면 null", () => {
  assert.equal(toRawBookHitFromNlk({ AUTHOR: "손원평", TITLE: "" }), null);
  assert.equal(toRawBookHitFromNlk({ TITLE: "아몬드" }), null);
  assert.equal(toRawBookHitFromNlk(null), null);
});
