import assert from "node:assert/strict";
import { test } from "node:test";

import {
  mockSource,
  selectSourceKind,
  toRawBookHitFromDataGoKr,
  toRawBookHitFromNlk,
} from "./source";

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
    EA_ADD_CODE: "43810",
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
    targetGradeMin: 4,
    targetGradeMax: 9,
  });
});

/**
 * EA_ADD_CODE(부가기호) 첫 자리는 독자대상기호다 — 6/7=초등·아동, 4=청소년,
 * 5=중고교 학습참고서, 9=전문(성인) 등. 아래 값들은 실제 응답에서 그대로 옮긴 것이다
 * (43810=아몬드/청소년, 95600=성인 대상 국가고시 문제집, 03810/05810/05800=교양).
 */
test("EA_ADD_CODE 9(전문)는 학생 대상이 아니라서 결과에서 제외한다", () => {
  const hit = toRawBookHitFromNlk({
    PUBLISHER: "(주식회사) 엘씨나인",
    AUTHOR: "저자 : 아몬드영",
    TITLE: "[전자책] 아몬드영 미용사(피부) 국가고시 원패스 필기 모의고사 문제집",
    EA_ISBN: "9791198761538",
    EA_ADD_CODE: "95600",
    TITLE_URL: "",
    SUBJECT: "6",
    KDC: "",
  });
  assert.equal(hit, null);
});

test("EA_ADD_CODE 0(교양)은 제외한다 — 웹소설·성인 교양이 여기 섞인다. 아몬드는 시드(curated)가 갖고 있다", () => {
  const hit = toRawBookHitFromNlk({
    PUBLISHER: "창비",
    AUTHOR: "지은이: 손원평",
    TITLE: "아몬드",
    EA_ISBN: "9788936475659",
    EA_ADD_CODE: "03810",
    TITLE_URL: "",
    SUBJECT: "",
    KDC: "",
  });
  assert.equal(hit, null);
});

test("EA_ADD_CODE 7(아동)은 1~6학년으로 매핑한다", () => {
  const hit = toRawBookHitFromNlk({
    PUBLISHER: "사계절",
    AUTHOR: "황선미",
    TITLE: "마당을 나온 암탉",
    EA_ISBN: "9788932917245",
    EA_ADD_CODE: "78630",
    TITLE_URL: "",
    SUBJECT: "",
    KDC: "",
  });
  assert.equal(hit?.targetGradeMin, 1);
  assert.equal(hit?.targetGradeMax, 6);
});

test("EA_ADD_CODE 없으면(구버전 레코드·전자책 등) 제외한다 — 웹소설이 대부분 여기다", () => {
  const hit = toRawBookHitFromNlk({
    PUBLISHER: "창비",
    AUTHOR: "손원평",
    TITLE: "아몬드",
    EA_ISBN: "9788936434267",
  });
  assert.equal(hit, null);
});

test("toRawBookHitFromNlk는 첫 역할 라벨만 벗겨내고 나머지 공역자 표기는 남긴다", () => {
  const hit = toRawBookHitFromNlk({
    PUBLISHER: "(주식회사)좋은땅",
    AUTHOR: "원작자 :  앙투안 드 생텍쥐페리;역자 :  홍희숙;",
    TITLE: "어린왕자 요약",
    EA_ISBN: "9791166496103",
    EA_ADD_CODE: "73810",
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

/**
 * 아래는 실제 캡처한 응답이 아니라 culture.go.kr의 "국립어린이청소년도서관_사서추천도서"
 * 소개 페이지(id=674)에 문서화된 필드명(TITLE/AUTHOR/ISBN/AFFILIATION/IMAGE_OBJECT)
 * 기준으로 만든 테스트다. DATA_GO_KR_KEY 발급되면 실제 응답으로 재검증할 것.
 */
test("toRawBookHitFromDataGoKr는 문서화된 필드명으로 파싱한다", () => {
  const hit = toRawBookHitFromDataGoKr({
    TITLE: "아몬드",
    AUTHOR: "손원평",
    ISBN: "9788936434267",
    AFFILIATION: "창비",
    IMAGE_OBJECT: "",
  });
  assert.deepEqual(hit, {
    isbn13: "9788936434267",
    title: "아몬드",
    author: "손원평",
    publisher: "창비",
    coverUrl: null,
    rawCategory: null,
    kdc: null,
    targetGradeMin: null,
    targetGradeMax: null,
  });
});

test("toRawBookHitFromDataGoKr는 title이나 author가 없으면 null", () => {
  assert.equal(toRawBookHitFromDataGoKr({ AUTHOR: "손원평", TITLE: "" }), null);
  assert.equal(toRawBookHitFromDataGoKr({ TITLE: "아몬드" }), null);
  assert.equal(toRawBookHitFromDataGoKr(null), null);
});

test("전자책·오디오북(EBOOK_YN=Y, FORM)은 제외한다 — 웹소설·웹툰이 여기 있고 종이책 중복 판본이다", () => {
  const base = { PUBLISHER: "창비", AUTHOR: "손원평", TITLE: "아몬드", EA_ISBN: "9788936434267", EA_ADD_CODE: "43810", TITLE_URL: "", SUBJECT: "", KDC: "" };
  assert.equal(toRawBookHitFromNlk({ ...base, EBOOK_YN: "Y", FORM: "전자책" }), null);
  assert.equal(toRawBookHitFromNlk({ ...base, EBOOK_YN: "N", FORM: "오디오북" }), null);
  assert.notEqual(toRawBookHitFromNlk({ ...base, EBOOK_YN: "N", FORM: "종이책" }), null);
});

test("청소년(4) + 만화(둘째 자리 7)는 제외한다 — 성인 취향 만화가 그대로 들어온다", () => {
  const base = { PUBLISHER: "학산", AUTHOR: "Go Nagai", TITLE: "아몬", EA_ISBN: "9791100000009", TITLE_URL: "", SUBJECT: "8", KDC: "", EBOOK_YN: "N" };
  assert.equal(toRawBookHitFromNlk({ ...base, EA_ADD_CODE: "47830" }), null);
  // 아동(7) 그림책·만화는 둔다
  assert.notEqual(toRawBookHitFromNlk({ ...base, EA_ADD_CODE: "77810" }), null);
});
