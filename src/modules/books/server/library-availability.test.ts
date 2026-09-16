import assert from "node:assert/strict";
import { test } from "node:test";

import { checkNlkLibraryAvailability, pickUsableOrgLink } from "./library-availability";

/**
 * 아래 result 배열들은 2026-09-16에 실제 NLK_API_KEY로
 * https://www.nl.go.kr/NL/search/openApi/search.do?apiType=json&kwd=<isbn> 를
 * 호출해 받은 실제 응답을 옮긴 것이다 (필드 일부만).
 */

test("licYn=N + 실제 orgLink면 그 주소를 돌려준다 (전래동화, 8989929652)", () => {
  const result = [
    {
      isbn: "8989929652",
      docYn: "NL_VIEWER",
      licYn: "N",
      orgLink: "https://viewer.nl.go.kr/nlmivs/viewWonmun_js.jsp?cno=KJU200407684",
    },
  ];
  assert.equal(
    pickUsableOrgLink(result, "8989929652"),
    "https://viewer.nl.go.kr/nlmivs/viewWonmun_js.jsp?cno=KJU200407684",
  );
});

test("licYn=N이어도 orgLink가 비어있으면 null (아몬드, 9788936434267 — 종이책만 소장)", () => {
  const result = [
    { isbn: "9788936434267", docYn: "N", licYn: "N", orgLink: "" },
  ];
  assert.equal(pickUsableOrgLink(result, "9788936434267"), null);
});

test("licYn=S(과금)면 orgLink가 있어도 null", () => {
  const result = [
    {
      isbn: "9788936456788",
      docYn: "NL_VIEWER",
      licYn: "S",
      orgLink: "이용불가",
    },
  ];
  assert.equal(pickUsableOrgLink(result, "9788936456788"), null);
});

test("isbn이 일치하지 않는 결과는 무시한다", () => {
  const result = [
    { isbn: "0000000000000", licYn: "N", orgLink: "https://example.com" },
  ];
  assert.equal(pickUsableOrgLink(result, "8989929652"), null);
});

test("result가 배열이 아니면 null", () => {
  assert.equal(pickUsableOrgLink(undefined, "8989929652"), null);
  assert.equal(pickUsableOrgLink(null, "8989929652"), null);
  assert.equal(pickUsableOrgLink({}, "8989929652"), null);
});

test("checkNlkLibraryAvailability는 NLK_API_KEY 없으면 호출 없이 null", async () => {
  const original = process.env.NLK_API_KEY;
  delete process.env.NLK_API_KEY;
  try {
    assert.equal(await checkNlkLibraryAvailability("8989929652"), null);
  } finally {
    if (original !== undefined) process.env.NLK_API_KEY = original;
  }
});
