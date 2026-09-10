/**
 * reader 모듈 목 데이터. ⚠️ 임시 — 실제 API 가 붙으면 지운다.
 *
 * 본문은 저작권 만료(public domain) 텍스트만 다룬다.
 * 여기 실린 것은 전래동화라 저작자가 없다 — 실제 서비스의 저작권 만료 도서 본문은
 * 위키문헌에서 받아 book_contents 에 넣는다.
 */
import type { DictResponse, ReaderChapterResponse } from "@/shared/types";
import { delay } from "@/modules/review";

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

/** GET /api/reader/:bookId?chapter= */
export async function getChapter(id: string): Promise<ReaderChapterResponse> {
  await delay(250);
  const t = TEXTS.find((x) => x.id === id) ?? TEXTS[0];
  return { title: t.title, body: t.body };
}

/**
 * GET /api/dict?word=
 * 실제로는 국립국어원 한국어기초사전 API 를 부른다.
 * 사전에 없는 낱말도 화면이 깨지지 않게 안내 문구를 돌려준다.
 */
const DICT: Record<string, string> = {
  처마: "지붕이 벽보다 밖으로 튀어나온 부분.",
  심술: "온당하지 않게 고집을 부리는 마음.",
  제비: "봄에 와서 가을에 돌아가는 철새.",
  형제: "형과 아우를 아울러 이르는 말.",
  살림: "한집안을 이루어 살아가는 일.",
  우화: "동물에 빗대어 교훈을 주는 짧은 이야기.",
  결승선: "달리기에서 마지막에 닿아야 하는 선.",
};

export async function lookup(word: string): Promise<DictResponse> {
  await delay(200);
  return {
    word,
    definition: DICT[word] ?? "아직 뜻을 못 찾았어. 다른 낱말을 눌러볼까?",
    source: "국립국어원 한국어기초사전",
  };
}

/** 사전에 실린 낱말인지 — 본문에서 눌러볼 수 있게 표시하는 데 쓴다. */
export const KNOWN_WORDS = Object.keys(DICT);
