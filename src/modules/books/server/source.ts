/**
 * 외부 도서 소스 어댑터.
 *
 * 알라딘 오픈API는 2026-09-04 서비스 종료됨 — 국립중앙도서관(NLK)을 주 소스로,
 * 국립어린이청소년도서관(data.go.kr)을 보조로 쓴다. 둘 다 키가 없으면(지금 상태) mock.
 * 실제 키가 있는데 호출이 실패하면 mock으로 조용히 폴백하지 않고 에러를 그대로 올린다
 * (docs/superpowers/specs/2026-09-14-books-search-recommend-design.md).
 *
 * ⚠️ nlkSource / dataGoKrSource는 미검증이다 — 두 API 다 인증키가 아직 없어서 실제
 * 응답으로 테스트하지 못했다. 파라미터명은 각 API의 일반적인 공개 문서 관례를 따른
 * 최선의 추정이다. 키가 발급되면 scripts/books-smoke.ts 로 가장 먼저 검증할 것.
 */
import "server-only";

import { BOOKS } from "../mock";

export interface RawBookHit {
  isbn13: string | null;
  title: string;
  author: string;
  publisher: string | null;
  coverUrl: string | null;
  /** 알라딘류 카테고리 문자열. 소스에 따라 없을 수 있다 */
  rawCategory: string | null;
  /** 국립중앙도서관 KDC 분류기호 */
  kdc: string | null;
}

export interface BookSource {
  name: "nlk" | "data_go_kr" | "mock";
  search(query: string): Promise<RawBookHit[]>;
}

export class BookSourceError extends Error {
  constructor(
    public sourceName: string,
    message: string,
  ) {
    super(message);
    this.name = "BookSourceError";
  }
}

/** 어떤 소스를 쓸지 결정하는 순수 함수 — env를 인자로 받아 테스트하기 쉽게 한다 */
export function selectSourceKind(env: {
  NLK_API_KEY?: string;
  DATA_GO_KR_KEY?: string;
}): "nlk" | "data_go_kr" | "mock" {
  if (env.NLK_API_KEY) return "nlk";
  if (env.DATA_GO_KR_KEY) return "data_go_kr";
  return "mock";
}

export const mockSource: BookSource = {
  name: "mock",
  async search(query) {
    const q = query.trim();
    if (!q) return [];
    return BOOKS.filter(
      (b) => b.title.includes(q) || b.author.includes(q),
    ).map((b) => ({
      isbn13: b.isbn13,
      title: b.title,
      author: b.author,
      publisher: b.publisher,
      coverUrl: b.cover_url,
      rawCategory: b.tags[0] ?? null,
      kdc: null,
    }));
  },
};

/** 중첩 객체에서 배열 필드를 안전하게 꺼낸다. 경로 중간에 없으면 null */
function extractArray(body: unknown, path: string[]): unknown[] | null {
  let cur: unknown = body;
  for (const key of path) {
    if (typeof cur !== "object" || cur === null) return null;
    cur = (cur as Record<string, unknown>)[key];
  }
  return Array.isArray(cur) ? cur : null;
}

function toRawBookHitFromNlk(raw: unknown): RawBookHit | null {
  if (typeof raw !== "object" || raw === null) return null;
  const r = raw as Record<string, unknown>;
  const title = typeof r.TITLE === "string" ? r.TITLE : null;
  const author = typeof r.AUTHOR === "string" ? r.AUTHOR : null;
  if (!title || !author) return null;
  return {
    isbn13: typeof r.EA_ISBN === "string" && r.EA_ISBN ? r.EA_ISBN : null,
    title,
    author,
    publisher: typeof r.PUBLISHER === "string" ? r.PUBLISHER : null,
    coverUrl: typeof r.TITLE_URL === "string" ? r.TITLE_URL : null,
    rawCategory: typeof r.SUBJECT === "string" ? r.SUBJECT : null,
    kdc: typeof r.KDC === "string" ? r.KDC : null,
  };
}

/** 국립중앙도서관 서지정보(SEOJI) API */
export const nlkSource: BookSource = {
  name: "nlk",
  async search(query) {
    const key = process.env.NLK_API_KEY;
    if (!key) throw new BookSourceError("nlk", "NLK_API_KEY 가 없다");

    const url = new URL("https://seoji.nl.go.kr/landingPage/SearchApi.do");
    url.searchParams.set("cert_key", key);
    url.searchParams.set("result_style", "json");
    url.searchParams.set("page_no", "1");
    url.searchParams.set("page_size", "10");
    url.searchParams.set("title", query);

    let res: Response;
    try {
      res = await fetch(url, { signal: AbortSignal.timeout(5000) });
    } catch (err) {
      throw new BookSourceError("nlk", `네트워크 오류: ${(err as Error).message}`);
    }
    if (!res.ok) throw new BookSourceError("nlk", `HTTP ${res.status}`);

    const body: unknown = await res.json().catch(() => null);
    const docs = extractArray(body, ["docs"]);
    if (!docs) throw new BookSourceError("nlk", "응답 형식이 예상과 다르다");

    return docs
      .map(toRawBookHitFromNlk)
      .filter((hit): hit is RawBookHit => hit !== null);
  },
};

function toRawBookHitFromDataGoKr(raw: unknown): RawBookHit | null {
  if (typeof raw !== "object" || raw === null) return null;
  const r = raw as Record<string, unknown>;
  const title = typeof r.title === "string" ? r.title : null;
  const author = typeof r.author === "string" ? r.author : null;
  if (!title || !author) return null;
  return {
    isbn13: typeof r.isbn13 === "string" && r.isbn13 ? r.isbn13 : null,
    title,
    author,
    publisher: typeof r.publisher === "string" ? r.publisher : null,
    coverUrl: null,
    rawCategory: typeof r.kdcName === "string" ? r.kdcName : null,
    kdc: typeof r.kdc === "string" ? r.kdc : null,
  };
}

/** 국립어린이청소년도서관 사서추천도서 (data.go.kr) */
export const dataGoKrSource: BookSource = {
  name: "data_go_kr",
  async search(query) {
    const key = process.env.DATA_GO_KR_KEY;
    if (!key) throw new BookSourceError("data_go_kr", "DATA_GO_KR_KEY 가 없다");

    const url = new URL(
      "https://apis.data.go.kr/9720000/BookRecommendationInquiryService/getBookRecommendationList",
    );
    url.searchParams.set("serviceKey", key);
    url.searchParams.set("type", "json");
    url.searchParams.set("title", query);
    url.searchParams.set("numOfRows", "10");

    let res: Response;
    try {
      res = await fetch(url, { signal: AbortSignal.timeout(5000) });
    } catch (err) {
      throw new BookSourceError(
        "data_go_kr",
        `네트워크 오류: ${(err as Error).message}`,
      );
    }
    if (!res.ok) throw new BookSourceError("data_go_kr", `HTTP ${res.status}`);

    const body: unknown = await res.json().catch(() => null);
    const items = extractArray(body, ["response", "body", "items", "item"]);
    if (!items)
      throw new BookSourceError("data_go_kr", "응답 형식이 예상과 다르다");

    return items
      .map(toRawBookHitFromDataGoKr)
      .filter((hit): hit is RawBookHit => hit !== null);
  },
};

export function getBookSource(): BookSource {
  const kind = selectSourceKind({
    NLK_API_KEY: process.env.NLK_API_KEY,
    DATA_GO_KR_KEY: process.env.DATA_GO_KR_KEY,
  });
  if (kind === "nlk") return nlkSource;
  if (kind === "data_go_kr") return dataGoKrSource;
  return mockSource;
}
