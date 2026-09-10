/**
 * reader 모듈 목 데이터. ⚠️ 임시 — book_contents 에 시드가 들어오면 지운다.
 *
 * 사전(lookup·KNOWN_WORDS)과 본문 조회(getChapter)는 실제 API 로 대체됐다.
 * 남은 것은 책 목록·본문뿐이고, GET /api/reader/:bookId 가 붙으면 이 파일이 없어진다.
 *
 * 본문은 저작권 만료(public domain) 텍스트만 다룬다.
 * 여기 실린 것은 전래동화라 저작자가 없다 — 실제 서비스의 저작권 만료 도서 본문은
 * 위키문헌에서 받아 book_contents 에 넣는다.
 */
export interface DemoText {
  id: string;
  title: string;
  subtitle: string;
  body: string;
}

/** 목업 6 L392 의 본문을 그대로 쓴다. */
export const TEXTS: DemoText[] = [
  {
    id: "t1",
    title: "흥부와 놀부",
    subtitle: "한국 전래동화",
    body:
      "옛날 어느 마을에 흥부와 놀부, 두 형제가 살았어요. " +
      "동생 흥부는 마음이 착했지만 살림이 가난했고, 형 놀부는 부자였지만 심술이 사나웠지요. " +
      "어느 봄날, 다리를 다친 제비 한 마리가 흥부네 처마 밑으로 툭 떨어졌어요. " +
      "흥부는 제비의 다리를 정성껏 고쳐 주었답니다.",
  },
  {
    id: "t2",
    title: "토끼와 거북이",
    subtitle: "이솝 우화",
    body:
      "토끼는 자기 발이 빠른 것을 늘 자랑했어요. " +
      "느릿느릿 걷는 거북이를 보고 토끼가 비웃자, 거북이는 조용히 달리기를 겨루자고 했지요. " +
      "토끼는 한참을 앞서 달리다가 나무 그늘에서 낮잠이 들었어요. " +
      "그동안 거북이는 쉬지 않고 걸어서 먼저 결승선에 닿았답니다.",
  },
];
