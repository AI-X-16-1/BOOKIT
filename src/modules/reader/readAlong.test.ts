import assert from "node:assert/strict";
import { test } from "node:test";

import { advance, normalize, sameWord, splitWords } from "./readAlong";

const BOOK = splitWords(
  "어느 해 몹시 추운 겨울날이었습니다. 하늘에서는 흰 새의 날개같이 희고도 보드라운 눈송이가 펑 ─ 펑 ─ 쏟아져 내리고",
);

test("splitWords 는 본문 화면과 같은 규칙으로 나눈다", () => {
  // "─"(상자 그리기 선)는 구분자 목록에 없어서 화면에서도 낱말 버튼이 된다.
  // 색칠 위치가 화면의 낱말 버튼과 하나씩 맞아야 하므로 여기서도 그대로 남긴다
  assert.deepEqual(splitWords("펑 ─ 펑, 쏟아져!"), ["펑", "─", "펑", "쏟아져"]);
  assert.equal(normalize("겨울날이었습니다."), "겨울날이었습니다");
  assert.ok(!sameWord("─", "─"), "부호뿐인 낱말은 어떤 말과도 맞지 않는다");
});

test("조사가 붙고 떨어진 차이는 같은 낱말이다", () => {
  assert.ok(sameWord("하늘에서는", "하늘에서"));
  assert.ok(sameWord("소녀", "소녀가"));
  assert.ok(!sameWord("그러나", "그"), "한 글자는 앞머리 비교를 안 한다");
  assert.ok(!sameWord("눈송이가", "눈물이"));
});

test("처음부터 읽으면 읽은 만큼 커서가 간다", () => {
  assert.equal(advance(BOOK, 0, ["어느", "해", "몹시", "추운"]), 4);
});

test("몇 낱말 놓쳐도 뒤에서 맞으면 따라잡는다", () => {
  // "해" 와 "몹시" 를 못 알아들었다
  assert.equal(advance(BOOK, 1, ["추운", "겨울날이었습니다"]), 5);
});

test("붙어서 들린 말도 받는다", () => {
  const words = splitWords("나는 할 수 있다고 말했다");
  assert.equal(advance(words, 1, ["할수", "있다고"]), 4);
});

test("잡음이나 딴말이면 커서는 그대로다", () => {
  assert.equal(advance(BOOK, 3, ["오늘", "점심", "뭐", "먹지"]), 3);
});

test("중간부터 읽기 시작해도 두 낱말이 맞으면 닻을 내린다", () => {
  // 커서는 0 인데 아이는 "희고도 보드라운 눈송이가" 부터 읽었다 (9~11번째, WINDOW 밖)
  assert.equal(advance(BOOK, 0, ["희고도", "보드라운", "눈송이가"]), 12);
});

test("들린 말의 첫 쌍이 잡음이어도 뒤 쌍에서 닻을 내린다", () => {
  assert.equal(advance(BOOK, 0, ["음", "저기", "희고도", "보드라운"]), 11);
});

test("앞으로 돌아가 다시 읽으면 커서도 돌아간다", () => {
  assert.equal(advance(BOOK, 12, ["어느", "해"]), 2);
});

/**
 * 아래는 2026-09-18 실제 크롬 음성 인식(구글)이 「참된 동정」 첫 문장들을 듣고 낸
 * **확정 결과 그대로**다. 합성 음성을 마이크 입력으로 넣어 받았다 (PR 설명 참고).
 */
test("실측 1 — '어느 회 몹시 추 결말이었습니다' 는 첫 문장 다섯 낱말을 다 읽은 것이다", () => {
  assert.equal(advance(BOOK, 0, splitWords("어느 회 몹시 추 결말이었습니다")), 5);
});

test("실측 2 — 같은 문장을 다시 들은 '좋은 겨울 날이었습니다' 에는 뒤로 튀지 않는다", () => {
  assert.equal(advance(BOOK, 5, splitWords("좋은 겨울 날이었습니다")), 5);
});

test("실측 3 — '하늘에서는 흰색 나에게 같이 이고도 보도록' 은 '희고도' 까지 따라간다", () => {
  // 하늘에서는(5) 흰(6)←흰색 · 새의(7)는 놓침 · 날개같이(8)←같이 · 희고도(9)←이고도.
  // 보드라운(10)←보도록 은 너무 달라 받지 않는다
  assert.equal(advance(BOOK, 5, splitWords("하늘에서는 흰색 나에게 같이 이고도 보도록")), 10);
});

test("비슷한 말은 바로 다음 한두 낱말에만 받는다 — 멀리 있는 한 글자 말에 튀지 않는다", () => {
  // "회" 는 "해" 와 자모 한 자 차이 — 바로 다음이거나 그다음이면 받는다
  assert.equal(advance(BOOK, 1, ["회"]), 2, "바로 다음(해)");
  assert.equal(advance(BOOK, 0, ["회"]), 2, "그다음(해) — '어느' 를 못 들었어도 따라간다");
  // "펑" 은 "해" 와 자모 세 자 차이라 바로 다음이어도 받지 않는다
  assert.equal(advance(BOOK, 1, ["펑"]), 1);
  // 커서 5(하늘에서는) 에서 "펑" 과 한 글자 차이인 "평" 은 12번째라 받지 않는다
  assert.equal(advance(BOOK, 5, ["평"]), 5);
});
