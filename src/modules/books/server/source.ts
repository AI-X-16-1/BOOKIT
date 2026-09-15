/**
 * 외부 도서 소스 어댑터.
 *
 * 알라딘 오픈API는 2026-09-04 서비스 종료됨 — 국립중앙도서관(NLK)을 주 소스로,
 * 국립어린이청소년도서관(data.go.kr)을 보조로 쓴다. 둘 다 키가 없으면(지금 상태) mock.
 * 실제 키가 있는데 호출이 실패하면 mock으로 조용히 폴백하지 않고 에러를 그대로 올린다
 * (docs/superpowers/specs/2026-09-14-books-search-recommend-design.md).
 *
 * nlkSource는 2026-09-15에 실제 NLK_API_KEY로 검증했다 — 요청 파라미터
 * (cert_key/result_style/page_no/page_size/title)와 최상위 필드명(docs/TITLE/
 * AUTHOR/PUBLISHER/EA_ISBN/TITLE_URL/SUBJECT/KDC)은 전부 맞았다. 다만 두 가지는
 * 파싱 단계에서 정리해야 했다: AUTHOR는 "지은이: 손원평", "원작자 :  … ;역자 :  …;"처럼
 * 역할 라벨이 붙어 오고(첫 라벨만 벗겨낸다 — 공역자까지 완벽히 정리하진 않는다),
 * 값이 없는 필드는 null이 아니라 빈 문자열 ""로 온다(null로 정규화한다).
 *
 * dataGoKrSource는 2026-09-15에 실제 DATA_GO_KR_KEY로 검증했다 — 엔드포인트·
 * 파라미터·응답 필드(TITLE/AUTHOR/ISBN/AFFILIATION/IMAGE_OBJECT 등)는 문서
 * (culture.go.kr id=674) 그대로였다. 다만 응답이 JSON이 아니라 **XML**로 온다
 * (`type=json` 등 어떤 파라미터를 줘도 XML만 준다) — `fast-xml-parser`로 파싱한다.
 * `numOfRows=1`이면 `item`이 배열이 아니라 객체 하나로 오고, `ISBN`/`LOCAL_ID`
 * 같은 숫자로 보이는 필드는 파서가 기본값으로 자동으로 number 타입으로 바꿔버린다 —
 * 둘 다 파서 옵션(`isArray`, `parseTagValue: false`)으로 막는다.
 */
import "server-only";

import { XMLParser } from "fast-xml-parser";

import { BOOKS } from "../mock";

/**
 * 값은 전부 문자열로 유지하고(숫자로 보이는 ISBN 등을 number로 바꾸지 않는다),
 * item이 하나뿐이어도 항상 배열로 만든다(기본값은 단일 객체라 배열 처리 코드가 깨진다).
 */
const dataGoKrXmlParser = new XMLParser({
  parseTagValue: false,
  isArray: (name) => name === "item",
});

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
  /** 대상 학년 추정치. 소스가 판단할 수 없으면 둘 다 null(전체 학년 대상 취급) */
  targetGradeMin: number | null;
  targetGradeMax: number | null;
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
      targetGradeMin: b.target_grade_min,
      targetGradeMax: b.target_grade_max,
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

/** NLK API는 값이 없는 필드를 null이 아니라 ""로 준다 — null로 정규화한다 */
function nullIfEmpty(value: string): string | null {
  return value === "" ? null : value;
}

/**
 * "지은이: 손원평", "저자 : 앙투안 드 생텍쥐페리" 같은 앞쪽 역할 라벨 하나만 벗겨낸다.
 * "원작자 :  …;역자 :  …;"처럼 여러 역할이 세미콜론으로 이어진 경우 첫 라벨만 지우고
 * 나머지는 그대로 둔다 — 흔한 단일 저자 표기를 깔끔하게 만드는 게 목적이지, 공역자까지
 * 완벽하게 구조화하는 건 이 어댑터의 범위 밖이다.
 */
const AUTHOR_ROLE_PREFIX_RE = /^[가-힣]{1,4}\s*[:：]\s*/;
function stripAuthorRolePrefix(author: string): string {
  return author.replace(AUTHOR_ROLE_PREFIX_RE, "").trim();
}

/**
 * 한국 ISBN 부가기호(EA_ADD_CODE, 5자리) 첫 자리 = 독자대상기호.
 * 7=아동, 6=학습참고서(초등), 4=청소년 — 이 셋만 통과시키고 학년 범위로 매핑한다.
 *
 * 0=교양은 처음엔 통과시켰는데(아몬드·어린 왕자 같은 좋은 책이 여기 있어서), 웹소설·
 * 라이트노벨·성인 교양서가 전부 0 이라 "나의" 한 글자에 "나의 절륜 히어로님" 류가
 * 초등학생 검색창에 올라왔다 (프로덕션 2026-09-15). 0·공백·5(중고교 학습참고서)·
 * 1·2·9 는 전부 제외한다. 0 에 있던 좋은 책은 시드(curated)가 갖고 있어 DB 검색이
 * 먼저 찾는다 (search.ts).
 *
 * ⚠️ 이 매핑은 실제 API 문서로 재검증한 게 아니라 알려진 출판 표준(ISBN 부가기호)
 * 지식에 기반한 추정이다. 실 검색 결과를 보면서 필요하면 조정할 것.
 */
function classifyAudience(eaAddCode: string | null): {
  targetGradeMin: number | null;
  targetGradeMax: number | null;
  exclude: boolean;
} {
  const readerCode = eaAddCode?.charAt(0);
  switch (readerCode) {
    case "6":
    case "7":
      return { targetGradeMin: 1, targetGradeMax: 6, exclude: false };
    case "4":
      return { targetGradeMin: 4, targetGradeMax: 9, exclude: false };
    default:
      // 0(교양)·공백·5(중고교 학습참고서)·1·2·9 — 아동·청소년 도서가 아니다
      return { targetGradeMin: null, targetGradeMax: null, exclude: true };
  }
}

export function toRawBookHitFromNlk(raw: unknown): RawBookHit | null {
  if (typeof raw !== "object" || raw === null) return null;
  const r = raw as Record<string, unknown>;
  const title = typeof r.TITLE === "string" ? nullIfEmpty(r.TITLE) : null;
  const rawAuthor = typeof r.AUTHOR === "string" ? nullIfEmpty(r.AUTHOR) : null;
  if (!title || !rawAuthor) return null;

  const eaAddCode = typeof r.EA_ADD_CODE === "string" ? nullIfEmpty(r.EA_ADD_CODE) : null;
  const audience = classifyAudience(eaAddCode);
  if (audience.exclude) return null;

  return {
    isbn13: typeof r.EA_ISBN === "string" ? nullIfEmpty(r.EA_ISBN) : null,
    title,
    author: stripAuthorRolePrefix(rawAuthor),
    publisher: typeof r.PUBLISHER === "string" ? nullIfEmpty(r.PUBLISHER) : null,
    coverUrl: typeof r.TITLE_URL === "string" ? nullIfEmpty(r.TITLE_URL) : null,
    rawCategory: typeof r.SUBJECT === "string" ? nullIfEmpty(r.SUBJECT) : null,
    kdc: typeof r.KDC === "string" ? nullIfEmpty(r.KDC) : null,
    targetGradeMin: audience.targetGradeMin,
    targetGradeMax: audience.targetGradeMax,
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

/**
 * 응답 필드는 문화포털(culture.go.kr)의 "국립어린이청소년도서관_사서추천도서"
 * API 소개 페이지(id=674, _OLD 아닌 정식 버전)에 문서화된 14개 필드를 그대로 썼다:
 * TITLE/AUTHOR/ISBN/ISSUED_DATE/COLLECTED_DATE/REG_DT/DESCRIPTION/
 * TABLE_OF_CONTENTS/SUB_DESCRIPTION/IMAGE_OBJECT/URL/LOCAL_ID/UCI/AFFILIATION.
 * ⚠️ 이 필드명은 문서 기준이고, 정확한 응답 중첩 구조(response.body.items.item
 * 여부)는 문서에 샘플 응답이 없어 실제 호출로 검증 못 했다 — DATA_GO_KR_KEY 발급되면
 * 가장 먼저 확인할 것.
 */
export function toRawBookHitFromDataGoKr(raw: unknown): RawBookHit | null {
  if (typeof raw !== "object" || raw === null) return null;
  const r = raw as Record<string, unknown>;
  const title = typeof r.TITLE === "string" ? nullIfEmpty(r.TITLE) : null;
  const author = typeof r.AUTHOR === "string" ? nullIfEmpty(r.AUTHOR) : null;
  if (!title || !author) return null;
  return {
    isbn13: typeof r.ISBN === "string" ? nullIfEmpty(r.ISBN) : null,
    title,
    author,
    publisher: typeof r.AFFILIATION === "string" ? nullIfEmpty(r.AFFILIATION) : null,
    coverUrl: typeof r.IMAGE_OBJECT === "string" ? nullIfEmpty(r.IMAGE_OBJECT) : null,
    rawCategory: null,
    kdc: null,
    // 국립어린이청소년도서관 사서추천도서 자체가 이미 아동·청소년 대상으로 큐레이션된
    // 목록이라 별도 학년 필터가 필요 없다.
    targetGradeMin: null,
    targetGradeMax: null,
  };
}

/**
 * 국립어린이청소년도서관 사서추천도서.
 *
 * ⚠️ 이 API는 제목/키워드로 검색하는 파라미터가 없다 — serviceKey/numOfRows/pageNo
 * 뿐인 목록 조회 API다(culture.go.kr id=674 문서 확인, 2026-09-15). 그래서 한 페이지를
 * 받아온 뒤 제목·저자에 검색어가 들어있는지 우리 쪽에서 직접 걸러낸다. 추천 목록
 * 전체가 100건을 넘으면 이 방식으론 뒷페이지 결과를 놓칠 수 있다 — 이 소스는
 * "사서가 이미 골라둔 소규모 추천 목록"이라는 전제로 설계됐다.
 */
export const dataGoKrSource: BookSource = {
  name: "data_go_kr",
  async search(query) {
    const key = process.env.DATA_GO_KR_KEY;
    if (!key) throw new BookSourceError("data_go_kr", "DATA_GO_KR_KEY 가 없다");

    const url = new URL("https://api.kcisa.kr/openapi/API_LIB_052/request");
    url.searchParams.set("serviceKey", key);
    url.searchParams.set("numOfRows", "100");
    url.searchParams.set("pageNo", "1");

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

    const xml = await res.text();
    const body: unknown = (() => {
      try {
        return dataGoKrXmlParser.parse(xml);
      } catch {
        return null;
      }
    })();
    const items = extractArray(body, ["response", "body", "items", "item"]);
    if (!items)
      throw new BookSourceError("data_go_kr", "응답 형식이 예상과 다르다");

    const q = query.trim();
    return items
      .map(toRawBookHitFromDataGoKr)
      .filter((hit): hit is RawBookHit => hit !== null)
      .filter((hit) => !q || hit.title.includes(q) || hit.author.includes(q));
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
