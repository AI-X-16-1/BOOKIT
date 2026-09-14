# books 검색·추천·상세 API Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `docs/spec.md` §5의 `GET /api/books/search`, `/recommend`, `/:id`를 실제로 동작시킨다 — 국립중앙도서관/국립어린이청소년도서관 어댑터(키 없으면 mock), DB 적재, 학년 기반 추천, 상세 조회.

**Architecture:** `src/modules/books/server/`에 어댑터(`source.ts`) · 임시 장르 매핑(`tags.ts`) · Supabase 포트(`db.ts`) · 비즈니스 로직(`search.ts`/`recommend.ts`/`detail.ts`) · 응답 헬퍼(`response.ts`)를 두고, `src/app/api/books/*/route.ts` 3개가 이를 얇게 호출한다. 모든 비즈니스 로직은 포트(인터페이스)를 인자로 받아 Supabase 없이 단위 테스트 가능하게 만든다.

**Tech Stack:** Next.js Route Handlers, Supabase(`@supabase/supabase-js`), Node 내장 `node:test`/`node:assert`(신규 테스트 프레임워크 추가 안 함), `tsx`(다른 모듈이 이미 쓰는 스크립트 러너 — 신규 도입 아님).

**Spec:** `docs/superpowers/specs/2026-09-14-books-search-recommend-design.md`

## Global Constraints

- LLM/외부 API 호출은 전부 서버 사이드에서만, 클라이언트에 키 노출 금지 (CLAUDE.md §1) — 키를 읽는 코드는 `server/source.ts`에만 두고 파일 상단에 `import "server-only"`를 붙인다.
- 크로스 모듈 import는 `index.ts`를 통해서만 (CLAUDE.md §2) — route handler는 `@/modules/books`에서만 가져온다.
- `src/shared/`와 `supabase/migrations/`는 김민경 소유, 이 세션에서 직접 수정하지 않는다 (CLAUDE.md §2) — 없는 `@/shared/api`는 books 모듈 내부에 임시로만 재현한다.
- Route handler는 얇게, 판단 로직은 모듈 서버 코드에 (CLAUDE.md §2 관례, 기존 onboarding route 참고).
- 커밋 메시지 형식 `type(scope): message`, scope는 `books` (CLAUDE.md §10).
- 실제 저장소는 `package-lock.json` + `npm ci`(CI) 기준으로 동작 중이므로(CLAUDE.md는 pnpm이라 적혀 있지만 실제 CI는 npm) 이 플랜은 npm 명령을 쓴다.
- 에러 메시지는 학생에게 보일 수 있으니 반말 존댓말 아닌 짧은 반말체 (CLAUDE.md §9).
- Points/도서 쓰기는 service role만 가능하도록 이미 마이그레이션되어 있다 (`supabase/migrations/0002_books.sql`) — insert는 반드시 admin 클라이언트로.

---

### Task 1: 입력 검증 (`schema.ts`)

**Files:**
- Create: `src/modules/books/schema.ts`
- Test: `src/modules/books/schema.test.ts`

**Interfaces:**
- Produces: `parseSearchQuery(raw: string | null): string`, `parseBookId(raw: string | undefined): string | null`

- [ ] **Step 1: Write the failing test**

```ts
// src/modules/books/schema.test.ts
import assert from "node:assert/strict";
import { test } from "node:test";

import { parseBookId, parseSearchQuery } from "./schema";

test("parseSearchQuery는 앞뒤 공백을 지운다", () => {
  assert.equal(parseSearchQuery("  아몬드  "), "아몬드");
});

test("parseSearchQuery는 null이면 빈 문자열", () => {
  assert.equal(parseSearchQuery(null), "");
});

test("parseBookId는 uuid 형식만 통과시킨다", () => {
  assert.equal(parseBookId("not-a-uuid"), null);
  assert.equal(
    parseBookId("123e4567-e89b-12d3-a456-426614174000"),
    "123e4567-e89b-12d3-a456-426614174000",
  );
});

test("parseBookId는 undefined면 null", () => {
  assert.equal(parseBookId(undefined), null);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --conditions=react-server --import tsx --test src/modules/books/schema.test.ts`
Expected: FAIL — `Cannot find module './schema'`

- [ ] **Step 3: Write minimal implementation**

```ts
// src/modules/books/schema.ts
/**
 * books 요청 파라미터 검증.
 *
 * GET 라우트만 있어서 body 검증은 필요 없다 — 쿼리 파라미터 두 개만 다룬다.
 */

/** 검색어. 없거나 공백뿐이면 빈 문자열로 정규화한다 (에러 아님 — 타이핑 중일 수 있음) */
export function parseSearchQuery(raw: string | null): string {
  return raw?.trim() ?? "";
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** books.id 형식 검증. 형식이 아니면 null — 호출부가 400으로 응답한다 */
export function parseBookId(raw: string | undefined): string | null {
  if (!raw) return null;
  return UUID_RE.test(raw) ? raw : null;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --conditions=react-server --import tsx --test src/modules/books/schema.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add src/modules/books/schema.ts src/modules/books/schema.test.ts
git commit -m "feat(books): 쿼리 파라미터 검증 추가"
```

---

### Task 2: 임시 장르 태그 매핑 (`server/tags.ts`)

**Files:**
- Create: `src/modules/books/server/tags.ts`
- Test: `src/modules/books/server/tags.test.ts`

**Interfaces:**
- Produces: `BOOK_GENRE_TAGS: readonly string[]`, `type BookGenreTag`, `mapToGenreTags(rawCategory: string | null, kdc: string | null): BookGenreTag[]`

- [ ] **Step 1: Write the failing test**

```ts
// src/modules/books/server/tags.test.ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --conditions=react-server --import tsx --test src/modules/books/server/tags.test.ts`
Expected: FAIL — `Cannot find module './tags'`

- [ ] **Step 3: Write minimal implementation**

```ts
// src/modules/books/server/tags.ts
/**
 * 임시 장르 태그 매핑.
 *
 * TODO(ai 모듈 복구 후 교체): `ai.normalizeGenreTags`로 이관한다
 * (docs/prompts.md §5, docs/superpowers/specs/2026-09-14-books-search-recommend-design.md).
 * 태그 목록은 그 문서의 고정 15개를 그대로 복제한 것이다 — 여기서 새 태그를 만들지 않는다.
 */

export const BOOK_GENRE_TAGS = [
  "성장소설",
  "판타지",
  "SF",
  "추리",
  "동화",
  "역사",
  "과학",
  "모험",
  "우정",
  "인물심리",
  "가족",
  "사회",
  "자연",
  "예술",
  "고전",
] as const;

export type BookGenreTag = (typeof BOOK_GENRE_TAGS)[number];

const KEYWORD_RULES: Array<[BookGenreTag, RegExp]> = [
  ["판타지", /판타지|마법|요정/],
  ["SF", /SF|공상과학|우주/],
  ["추리", /추리|미스터리|탐정/],
  ["동화", /동화|그림책/],
  ["역사", /역사|위인|전기/],
  ["과학", /과학|자연과학|수학/],
  ["모험", /모험|탐험/],
  ["우정", /우정|친구/],
  ["인물심리", /심리|감정/],
  ["가족", /가족|부모|형제/],
  ["사회", /사회|경제|정치/],
  ["자연", /자연|환경|동물|식물/],
  ["예술", /예술|미술|음악/],
  ["고전", /고전|명작/],
  ["성장소설", /성장|청소년소설|한국소설/],
];

/** KDC 대분류(맨 앞자리)로 넓게 잡는 보조 규칙. 확신 없으면 태그를 붙이지 않는다 */
const KDC_MAJOR_RULES: Record<string, BookGenreTag> = {
  "8": "성장소설",
  "9": "역사",
  "4": "과학",
};

export function mapToGenreTags(
  rawCategory: string | null,
  kdc: string | null,
): BookGenreTag[] {
  const tags = new Set<BookGenreTag>();

  if (rawCategory) {
    for (const [tag, pattern] of KEYWORD_RULES) {
      if (pattern.test(rawCategory)) tags.add(tag);
    }
  }

  if (tags.size === 0 && kdc) {
    const major = kdc.trim().charAt(0);
    const tag = KDC_MAJOR_RULES[major];
    if (tag) tags.add(tag);
  }

  return Array.from(tags).slice(0, 4);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --conditions=react-server --import tsx --test src/modules/books/server/tags.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add src/modules/books/server/tags.ts src/modules/books/server/tags.test.ts
git commit -m "feat(books): 임시 장르 태그 매핑 추가"
```

---

### Task 3: 응답 봉투 헬퍼 (`server/response.ts`)

**Files:**
- Create: `src/modules/books/server/response.ts`
- Test: `src/modules/books/server/response.test.ts`

**Interfaces:**
- Consumes: `ApiResponse<T>` from `@/shared/types`
- Produces: `ok<T>(data: T)`, `fail(code, message, status)`, `unauthorized()`, `badRequest(code, message)` — 전부 `NextResponse` 반환

- [ ] **Step 1: Write the failing test**

```ts
// src/modules/books/server/response.test.ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --conditions=react-server --import tsx --test src/modules/books/server/response.test.ts`
Expected: FAIL — `Cannot find module './response'`

- [ ] **Step 3: Write minimal implementation**

```ts
// src/modules/books/server/response.ts
/**
 * `{ data }` / `{ error }` 응답 봉투 — books 모듈 내부 임시 버전.
 *
 * 원래 `@/shared/api`(김민경 소유)에 같은 시그니처의 ok/fail/unauthorized가 있어야 하는데,
 * main 브랜치 유실로 지금 존재하지 않는다 (docs/superpowers/specs/2026-09-14-books-search-recommend-design.md).
 * shared/api가 복구되면 이 파일을 지우고 import만 바꾸면 되도록 이름과 반환 타입을 맞춰둔다.
 * shared/ 는 직접 고치지 않는다 (CLAUDE.md §2).
 */
import "server-only";

import { NextResponse } from "next/server";

import type { ApiResponse } from "@/shared/types";

export function ok<T>(data: T): NextResponse<ApiResponse<T>> {
  return NextResponse.json({ data });
}

export function fail(
  code: string,
  message: string,
  status: number,
): NextResponse<ApiResponse<never>> {
  return NextResponse.json({ error: { code, message } }, { status });
}

export function unauthorized(): NextResponse<ApiResponse<never>> {
  return fail("unauthorized", "로그인이 필요해.", 401);
}

export function badRequest(
  code: string,
  message: string,
): NextResponse<ApiResponse<never>> {
  return fail(code, message, 400);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --conditions=react-server --import tsx --test src/modules/books/server/response.test.ts`
Expected: PASS (4 tests). **문제 생기면:** `next/server`의 `NextResponse`가 순수 Node 실행 환경에서 생성자 에러를 내면(플레인 `Response`가 아니라 Next 내부 전역을 요구하는 경우), `import "server-only"`를 지우고 `NextResponse.json`을 표준 `Response.json`으로 바꿔 같은 시그니처를 유지한다 — 런타임 동작은 동일하고 타입 표기만 `NextResponse`로 캐스팅하면 된다.

- [ ] **Step 5: Commit**

```bash
git add src/modules/books/server/response.ts src/modules/books/server/response.test.ts
git commit -m "feat(books): 임시 응답 봉투 헬퍼 추가"
```

---

### Task 4: 외부 도서 소스 어댑터 (`server/source.ts`)

**Files:**
- Create: `src/modules/books/server/source.ts`
- Test: `src/modules/books/server/source.test.ts`
- Modify: `src/modules/books/mock.ts:22-27` (mock 도서 5권에 테스트용 `isbn13` 채우기 — 지금 전부 `null`이라 검색→적재 흐름을 mock으로 테스트할 방법이 없다)
- Modify: `src/modules/books/mock.ts:6` (`import { delay } from "@/modules/review"` 제거 — 구현 중 발견: `review/index.ts`가 `delay` 옆에 `"use client"` 컴포넌트(`WriteFlow` 등)를 같이 export해서, `mock.ts`를 import하는 순간 `next/link` 등 클라이언트 전용 코드까지 전부 로드된다. Next 번들러 안에서는 무해하지만, `--conditions=react-server`로 plain node에서 돌리면 `react.react-server.js`에 `createContext`가 없어서 크래시한다. `source.ts`가 `mockSource`를 위해 `BOOKS`를 가져오면서 처음 이 경로를 건드리게 됨. 고치는 법: `delay`를 review 모듈에서 import하지 말고, `mock.ts` 안에 한 줄로 직접 정의한다 — `const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));` (review 모듈의 것과 동일한 구현, cross-module 의존 자체가 불필요했다).

**Interfaces:**
- Consumes: `BOOKS` from `../mock`
- Produces: `interface RawBookHit`, `interface BookSource { name; search(query): Promise<RawBookHit[]> }`, `class BookSourceError`, `selectSourceKind(env): "nlk" | "data_go_kr" | "mock"`, `mockSource: BookSource`, `nlkSource: BookSource`, `dataGoKrSource: BookSource`, `getBookSource(): BookSource`

- [ ] **Step 1: mock.ts에 테스트용 isbn13 채우기**

`src/modules/books/mock.ts`의 `BOOKS` 배열에서 각 항목의 `isbn13: null`을 아래처럼 바꾼다 (실제 알라딘/출판사 ISBN이 아니라 내부 dedup 테스트용 placeholder임을 이름으로 분명히 한다):

```ts
// src/modules/books/mock.ts 의 BOOKS 배열 — isbn13 필드만 아래 값으로 교체
  { id: "b5", isbn13: "MOCK-ISBN-B5", title: "아몬드", author: "손원평", publisher: "창비", cover_url: null, tags: ["성장", "한국소설"], target_grade_min: 6, target_grade_max: 9, is_public_domain: false, library_url: null, aladin_url: null, cover: "green" },
  { id: "b6", isbn13: "MOCK-ISBN-B6", title: "완득이", author: "김려령", publisher: "창비", cover_url: null, tags: ["성장", "한국소설"], target_grade_min: 6, target_grade_max: 9, is_public_domain: false, library_url: null, aladin_url: null, cover: "coral" },
  { id: "b7", isbn13: "MOCK-ISBN-B7", title: "마당을 나온 암탉", author: "황선미", publisher: "사계절", cover_url: null, tags: ["동화", "성장"], target_grade_min: 3, target_grade_max: 6, is_public_domain: false, library_url: null, aladin_url: null, cover: "yellow" },
  { id: "b9", isbn13: "MOCK-ISBN-B9", title: "어린 왕자", author: "생텍쥐페리", publisher: "문학동네", cover_url: null, tags: ["고전", "철학"], target_grade_min: 4, target_grade_max: 9, is_public_domain: false, library_url: null, aladin_url: null, cover: "blue" },
  { id: "b15", isbn13: "MOCK-ISBN-B15", title: "몽실 언니", author: "권정생", publisher: "창비", cover_url: null, tags: ["역사", "한국소설"], target_grade_min: 5, target_grade_max: 8, is_public_domain: false, library_url: null, aladin_url: null, cover: "coral" },
```

- [ ] **Step 2: Write the failing test**

```ts
// src/modules/books/server/source.test.ts
import assert from "node:assert/strict";
import { test } from "node:test";

import { mockSource, selectSourceKind } from "./source";

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
  assert.equal(hits[0].isbn13, "MOCK-ISBN-B5");
});

test("mockSource는 빈 검색어에 빈 배열", async () => {
  assert.deepEqual(await mockSource.search("   "), []);
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `node --conditions=react-server --import tsx --test src/modules/books/server/source.test.ts`
Expected: FAIL — `Cannot find module './source'`

- [ ] **Step 4: Write minimal implementation**

```ts
// src/modules/books/server/source.ts
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
```

- [ ] **Step 5: Run test to verify it passes**

Run: `node --conditions=react-server --import tsx --test src/modules/books/server/source.test.ts`
Expected: PASS (5 tests)

- [ ] **Step 6: Commit**

```bash
git add src/modules/books/mock.ts src/modules/books/server/source.ts src/modules/books/server/source.test.ts
git commit -m "feat(books): 도서 소스 어댑터 추가 (nlk/data.go.kr/mock)"
```

---

### Task 5: Supabase 포트 (`server/db.ts`)

이 파일은 Supabase에 직접 의존해서 `node:test`로 단위 테스트하지 않는다 (실제 DB 연결이 필요함 — Task 9의 스모크 스크립트가 인메모리 fake로 이 인터페이스의 계약을 검증한다). 대신 타입체크로 계약을 고정한다.

**Files:**
- Create: `src/modules/books/server/db.ts`

**Interfaces:**
- Consumes: `BookitClient`, `Database` from `@/shared/supabase`; `Book` from `@/shared/types`
- Produces: `type BookInsertRow`, `interface BooksAdminPort { findByIsbn; insertBook }`, `interface BooksReadPort { listByGrade; getById }`, `createSupabaseBooksAdminPort(admin: BookitClient): BooksAdminPort`, `createSupabaseBooksReadPort(supabase: BookitClient): BooksReadPort`

- [ ] **Step 1: 구현**

```ts
// src/modules/books/server/db.ts
/**
 * books 테이블 접근을 인터페이스 뒤로 감춘다.
 *
 * search.ts/recommend.ts/detail.ts가 이 인터페이스만 알게 해서, Supabase 없이도
 * (인메모리 fake로) 비즈니스 로직을 테스트할 수 있게 한다.
 *
 * 쓰기(findByIsbn 결과가 없을 때의 insertBook)는 반드시 admin(service role) 클라이언트로
 * 호출해야 한다 — supabase/migrations/0002_books.sql이 authenticated insert를 막아뒀다.
 */
import "server-only";

import type { Book } from "@/shared/types";
import type { BookitClient, Database } from "@/shared/supabase";

export type BookInsertRow = Database["public"]["Tables"]["books"]["Insert"];

export interface BooksAdminPort {
  findByIsbn(isbn13: string): Promise<Book | null>;
  insertBook(row: BookInsertRow): Promise<Book>;
}

export interface BooksReadPort {
  listByGrade(gradeLevel: number, limit: number): Promise<Book[]>;
  getById(id: string): Promise<Book | null>;
}

export function createSupabaseBooksAdminPort(
  admin: BookitClient,
): BooksAdminPort {
  return {
    async findByIsbn(isbn13) {
      const { data, error } = await admin
        .from("books")
        .select("*")
        .eq("isbn13", isbn13)
        .maybeSingle();
      if (error) throw new Error(`책 조회 실패: ${error.message}`);
      return data ?? null;
    },
    async insertBook(row) {
      const { data, error } = await admin
        .from("books")
        .insert(row)
        .select("*")
        .single();
      if (error) throw new Error(`책 저장 실패: ${error.message}`);
      return data;
    },
  };
}

export function createSupabaseBooksReadPort(
  supabase: BookitClient,
): BooksReadPort {
  return {
    async listByGrade(gradeLevel, limit) {
      const { data, error } = await supabase
        .from("books")
        .select("*")
        .or(`target_grade_min.is.null,target_grade_min.lte.${gradeLevel}`)
        .or(`target_grade_max.is.null,target_grade_max.gte.${gradeLevel}`)
        .order("title", { ascending: true })
        .limit(limit);
      if (error) throw new Error(`추천 도서 조회 실패: ${error.message}`);
      return data ?? [];
    },
    async getById(id) {
      const { data, error } = await supabase
        .from("books")
        .select("*")
        .eq("id", id)
        .maybeSingle();
      if (error) throw new Error(`책 조회 실패: ${error.message}`);
      return data ?? null;
    },
  };
}
```

- [ ] **Step 2: 타입체크로 확인**

Run: `npx tsc --noEmit src/modules/books/server/db.ts --esModuleInterop --moduleResolution bundler --module esnext --target ES2017 --jsx react-jsx --paths.@/*=./src/* 2>&1 | head -30`

(이 파일 하나만 빠르게 훑는 용도. 전체 정합성은 Task 10의 `npm run typecheck`에서 최종 확인한다.) 에러가 나면 `@/shared/supabase`가 실제로 `BookitClient`/`Database`를 export하는지 `src/shared/supabase/index.ts`를 다시 확인한다.

- [ ] **Step 3: Commit**

```bash
git add src/modules/books/server/db.ts
git commit -m "feat(books): books 테이블 Supabase 포트 추가"
```

---

### Task 6: 검색 + 적재 로직 (`server/search.ts`)

**Files:**
- Create: `src/modules/books/server/search.ts`
- Test: `src/modules/books/server/search.test.ts`

**Interfaces:**
- Consumes: `BooksAdminPort`, `BookInsertRow` (Task 5); `BookSource`, `RawBookHit`, `BookSourceError` (Task 4); `mapToGenreTags` (Task 2)
- Produces: `type SearchResult = { ok: true; books: Book[] } | { ok: false; code: string; message: string; status: number }`, `searchAndUpsertBooks(port: BooksAdminPort, source: BookSource, query: string): Promise<SearchResult>`, `buildLibraryUrl(title: string, isbn13: string): string | null`

- [ ] **Step 1: Write the failing test**

```ts
// src/modules/books/server/search.test.ts
import assert from "node:assert/strict";
import { test } from "node:test";

import type { Book } from "@/shared/types";
import type { BookInsertRow, BooksAdminPort } from "./db";
import { searchAndUpsertBooks } from "./search";
import { BookSourceError, type BookSource } from "./source";

function makeFakePort(): BooksAdminPort & { rows: Book[] } {
  const rows: Book[] = [];
  return {
    rows,
    async findByIsbn(isbn13) {
      return rows.find((b) => b.isbn13 === isbn13) ?? null;
    },
    async insertBook(row: BookInsertRow) {
      const book: Book = {
        id: `id-${rows.length + 1}`,
        isbn13: row.isbn13 ?? null,
        title: row.title,
        author: row.author,
        publisher: row.publisher,
        cover_url: row.cover_url ?? null,
        tags: row.tags ?? [],
        target_grade_min: row.target_grade_min ?? null,
        target_grade_max: row.target_grade_max ?? null,
        is_public_domain: row.is_public_domain ?? false,
        library_url: row.library_url ?? null,
        aladin_url: row.aladin_url ?? null,
      };
      rows.push(book);
      return book;
    },
  };
}

test("검색어가 비어있으면 소스를 부르지 않고 빈 목록", async () => {
  let called = false;
  const source: BookSource = {
    name: "mock",
    async search() {
      called = true;
      return [];
    },
  };
  const result = await searchAndUpsertBooks(makeFakePort(), source, "   ");
  assert.deepEqual(result, { ok: true, books: [] });
  assert.equal(called, false);
});

test("isbn13 없는 결과는 걸러낸다", async () => {
  const source: BookSource = {
    name: "mock",
    async search() {
      return [
        {
          isbn13: null,
          title: "무제",
          author: "미상",
          publisher: null,
          coverUrl: null,
          rawCategory: null,
          kdc: null,
        },
      ];
    },
  };
  const result = await searchAndUpsertBooks(makeFakePort(), source, "무제");
  assert.deepEqual(result, { ok: true, books: [] });
});

test("같은 isbn13은 두 번 insert하지 않는다", async () => {
  const hit = {
    isbn13: "9791100000001",
    title: "아몬드",
    author: "손원평",
    publisher: "창비",
    coverUrl: null,
    rawCategory: "성장소설",
    kdc: null,
  };
  const source: BookSource = {
    name: "mock",
    async search() {
      return [hit];
    },
  };
  const port = makeFakePort();
  const first = await searchAndUpsertBooks(port, source, "아몬드");
  const second = await searchAndUpsertBooks(port, source, "아몬드");
  assert.equal(port.rows.length, 1);
  if (first.ok && second.ok) {
    assert.equal(first.books[0].id, second.books[0].id);
  }
});

test("BookSourceError는 book_source_unavailable로 변환된다", async () => {
  const source: BookSource = {
    name: "nlk",
    async search() {
      throw new BookSourceError("nlk", "테스트 오류");
    },
  };
  const result = await searchAndUpsertBooks(makeFakePort(), source, "아무거나");
  assert.deepEqual(result, {
    ok: false,
    code: "book_source_unavailable",
    message: "지금 책을 검색할 수 없어. 잠시 후 다시 해봐.",
    status: 503,
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --conditions=react-server --import tsx --test src/modules/books/server/search.test.ts`
Expected: FAIL — `Cannot find module './search'`

- [ ] **Step 3: Write minimal implementation**

```ts
// src/modules/books/server/search.ts
import "server-only";

import type { Book } from "@/shared/types";
import type { BookInsertRow, BooksAdminPort } from "./db";
import { BookSourceError, type BookSource, type RawBookHit } from "./source";
import { mapToGenreTags } from "./tags";

export type SearchResult =
  | { ok: true; books: Book[] }
  | { ok: false; code: string; message: string; status: number };

type IsbnHit = RawBookHit & { isbn13: string };

/**
 * TODO: 국회전자도서관 실제 검색 딥링크 URL 패턴 확인 후 채운다.
 * docs/superpowers/specs/2026-09-14-books-search-recommend-design.md 후속 작업 참고.
 */
export function buildLibraryUrl(_title: string, _isbn13: string): string | null {
  return null;
}

export function rawHitToBookInsert(hit: IsbnHit): BookInsertRow {
  return {
    isbn13: hit.isbn13,
    title: hit.title,
    author: hit.author,
    // Book.publisher는 non-null string인데 RawBookHit.publisher는 소스에 따라 null일 수
    // 있다 — 빈 문자열로 대체한다 (DB 마이그레이션은 publisher를 nullable로 뒀는데 db.ts의
    // 타입은 non-null이다; 이 불일치는 shared/ 소유자에게 확인 요청할 사항이지 여기서
    // 고치지 않는다).
    publisher: hit.publisher ?? "",
    cover_url: hit.coverUrl,
    tags: mapToGenreTags(hit.rawCategory, hit.kdc),
    target_grade_min: null,
    target_grade_max: null,
    is_public_domain: false,
    library_url: buildLibraryUrl(hit.title, hit.isbn13),
    aladin_url: null,
  };
}

async function upsertHit(port: BooksAdminPort, hit: IsbnHit): Promise<Book> {
  const existing = await port.findByIsbn(hit.isbn13);
  if (existing) return existing;
  return port.insertBook(rawHitToBookInsert(hit));
}

export async function searchAndUpsertBooks(
  port: BooksAdminPort,
  source: BookSource,
  query: string,
): Promise<SearchResult> {
  const q = query.trim();
  if (!q) return { ok: true, books: [] };

  let hits: RawBookHit[];
  try {
    hits = await source.search(q);
  } catch (err) {
    if (err instanceof BookSourceError) {
      return {
        ok: false,
        code: "book_source_unavailable",
        message: "지금 책을 검색할 수 없어. 잠시 후 다시 해봐.",
        status: 503,
      };
    }
    throw err;
  }

  const withIsbn = hits.filter((h): h is IsbnHit => h.isbn13 !== null);
  const books: Book[] = [];
  for (const hit of withIsbn) {
    books.push(await upsertHit(port, hit));
  }
  return { ok: true, books };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --conditions=react-server --import tsx --test src/modules/books/server/search.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add src/modules/books/server/search.ts src/modules/books/server/search.test.ts
git commit -m "feat(books): 검색 결과 적재(upsert) 로직 추가"
```

---

### Task 7: 추천 + 상세 로직 (`server/recommend.ts`, `server/detail.ts`)

**Files:**
- Create: `src/modules/books/server/recommend.ts`
- Create: `src/modules/books/server/detail.ts`
- Test: `src/modules/books/server/recommend.test.ts`

**Interfaces:**
- Consumes: `BooksReadPort` (Task 5)
- Produces: `recommendBooks(port: BooksReadPort, gradeLevel: number): Promise<{ books: Book[]; reasonTags: string[] }>`, `getBookById(port: BooksReadPort, id: string): Promise<Book | null>`

- [ ] **Step 1: Write the failing test**

```ts
// src/modules/books/server/recommend.test.ts
import assert from "node:assert/strict";
import { test } from "node:test";

import type { Book } from "@/shared/types";
import type { BooksReadPort } from "./db";
import { recommendBooks } from "./recommend";

function book(partial: Partial<Book>): Book {
  return {
    id: "id",
    isbn13: null,
    title: "제목",
    author: "저자",
    publisher: "출판사",
    cover_url: null,
    tags: [],
    target_grade_min: null,
    target_grade_max: null,
    is_public_domain: false,
    library_url: null,
    aladin_url: null,
    ...partial,
  };
}

test("추천 결과에 나온 태그들을 reasonTags로 합친다", async () => {
  const port: BooksReadPort = {
    async listByGrade() {
      return [book({ tags: ["성장소설"] }), book({ tags: ["모험", "성장소설"] })];
    },
    async getById() {
      return null;
    },
  };

  const result = await recommendBooks(port, 5);
  assert.equal(result.books.length, 2);
  assert.deepEqual(result.reasonTags.sort(), ["모험", "성장소설"].sort());
});

test("책이 없으면 reasonTags도 빈 배열", async () => {
  const port: BooksReadPort = {
    async listByGrade() {
      return [];
    },
    async getById() {
      return null;
    },
  };
  const result = await recommendBooks(port, 5);
  assert.deepEqual(result.reasonTags, []);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --conditions=react-server --import tsx --test src/modules/books/server/recommend.test.ts`
Expected: FAIL — `Cannot find module './recommend'`

- [ ] **Step 3: Write minimal implementation**

```ts
// src/modules/books/server/recommend.ts
import "server-only";

import type { Book } from "@/shared/types";
import type { BooksReadPort } from "./db";

export interface RecommendResult {
  books: Book[];
  reasonTags: string[];
}

export async function recommendBooks(
  port: BooksReadPort,
  gradeLevel: number,
): Promise<RecommendResult> {
  const books = await port.listByGrade(gradeLevel, 10);
  const reasonTags = Array.from(
    new Set(books.flatMap((b) => b.tags)),
  ).slice(0, 5);
  return { books, reasonTags };
}
```

```ts
// src/modules/books/server/detail.ts
import "server-only";

import type { Book } from "@/shared/types";
import type { BooksReadPort } from "./db";

export async function getBookById(
  port: BooksReadPort,
  id: string,
): Promise<Book | null> {
  return port.getById(id);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --conditions=react-server --import tsx --test src/modules/books/server/recommend.test.ts`
Expected: PASS (2 tests). (`detail.ts`는 단순 위임이라 별도 테스트 없이 Task 9 스모크로 확인한다.)

- [ ] **Step 5: Commit**

```bash
git add src/modules/books/server/recommend.ts src/modules/books/server/detail.ts src/modules/books/server/recommend.test.ts
git commit -m "feat(books): 추천·상세 조회 로직 추가"
```

---

### Task 8: 라우트 핸들러 3개 + index.ts

**Files:**
- Create: `src/app/api/books/search/route.ts`
- Create: `src/app/api/books/recommend/route.ts`
- Create: `src/app/api/books/[id]/route.ts`
- Modify: `src/modules/books/index.ts`

**Interfaces:**
- Consumes: 모든 이전 Task의 export를 `@/modules/books`를 통해서만
- Produces: `GET` 핸들러 3개 (Next.js Route Handler 계약)

- [ ] **Step 1: index.ts 갱신**

```ts
// src/modules/books/index.ts
/**
 * books — owner: 이승환
 *
 * 국립중앙도서관 / 국립어린이청소년도서관 API, 검색, 장르 인접 추천, 국회도서관 handoff.
 * 알라딘 오픈API는 2026-09-04 서비스 종료 — 국립중앙도서관을 주 소스로 대체했다
 * (docs/superpowers/specs/2026-09-14-books-search-recommend-design.md).
 *
 * 이 파일이 모듈의 유일한 public surface다.
 * 다른 모듈은 반드시 여기를 통해서만 import 한다 (CLAUDE.md §2).
 * 내부 구조: components/ · server/ · schema.ts
 *
 * 구현 완료: GET /api/books/search, /api/books/recommend, /api/books/:id
 *
 * 표지는 원래 알라딘 image URL을 쓸 계획이었으나 소스 교체로 대부분 비어 있을 수 있다 —
 * 그 경우 목업의 그라데이션 placeholder(CoverTone)를 그대로 쓴다 (CLAUDE.md §10).
 */

export { HomeScreen } from "./components/HomeScreen";
export { BOOKS, COVER, searchBooks, type CoverTone, type DemoBook } from "./mock";

export { parseBookId, parseSearchQuery } from "./schema";
export { badRequest, fail, ok, unauthorized } from "./server/response";
export {
  createSupabaseBooksAdminPort,
  createSupabaseBooksReadPort,
  type BooksAdminPort,
  type BooksReadPort,
  type BookInsertRow,
} from "./server/db";
export { getBookSource, mockSource } from "./server/source";
export { searchAndUpsertBooks, type SearchResult } from "./server/search";
export { recommendBooks, type RecommendResult } from "./server/recommend";
export { getBookById } from "./server/detail";
```

- [ ] **Step 2: 검색 라우트**

```ts
// src/app/api/books/search/route.ts
/**
 * GET /api/books/search?q= → { books[] }
 *
 * 소유: 이승환 (docs/spec.md §5).
 * 얇게 유지한다 — 판단은 modules/books의 searchAndUpsertBooks가 한다.
 */
import type { NextRequest, NextResponse } from "next/server";

import {
  createSupabaseBooksAdminPort,
  fail,
  getBookSource,
  ok,
  parseSearchQuery,
  searchAndUpsertBooks,
  unauthorized,
} from "@/modules/books";
import { createAdminClient } from "@/shared/supabase/admin";
import { createServerSupabase } from "@/shared/supabase/server";
import type { ApiResponse, BookSearchResponse } from "@/shared/types";

export async function GET(
  request: NextRequest,
): Promise<NextResponse<ApiResponse<BookSearchResponse>>> {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return unauthorized();

  const query = parseSearchQuery(request.nextUrl.searchParams.get("q"));
  const port = createSupabaseBooksAdminPort(createAdminClient());
  const result = await searchAndUpsertBooks(port, getBookSource(), query);
  if (!result.ok) return fail(result.code, result.message, result.status);
  return ok({ books: result.books });
}
```

- [ ] **Step 3: 추천 라우트**

```ts
// src/app/api/books/recommend/route.ts
/**
 * GET /api/books/recommend → { books[], reason_tags[] }
 *
 * 소유: 이승환 (docs/spec.md §5).
 */
import type { NextResponse } from "next/server";

import {
  createSupabaseBooksReadPort,
  fail,
  ok,
  recommendBooks,
  unauthorized,
} from "@/modules/books";
import { createServerSupabase } from "@/shared/supabase/server";
import type { ApiResponse, BookRecommendResponse } from "@/shared/types";

export async function GET(): Promise<
  NextResponse<ApiResponse<BookRecommendResponse>>
> {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return unauthorized();

  const profile = await supabase
    .from("profiles")
    .select("grade_level")
    .eq("id", user.id)
    .single();
  if (profile.error || profile.data.grade_level === null) {
    return fail("profile_incomplete", "학년 정보를 먼저 등록해줘.", 409);
  }

  const port = createSupabaseBooksReadPort(supabase);
  const { books, reasonTags } = await recommendBooks(
    port,
    profile.data.grade_level,
  );
  return ok({ books, reason_tags: reasonTags });
}
```

- [ ] **Step 4: 상세 라우트**

```ts
// src/app/api/books/[id]/route.ts
/**
 * GET /api/books/:id → { book }
 *
 * 소유: 이승환 (docs/spec.md §5).
 */
import type { NextResponse } from "next/server";

import {
  createSupabaseBooksReadPort,
  fail,
  getBookById,
  ok,
  parseBookId,
  unauthorized,
} from "@/modules/books";
import { createServerSupabase } from "@/shared/supabase/server";
import type { ApiResponse, BookDetailResponse } from "@/shared/types";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse<ApiResponse<BookDetailResponse>>> {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return unauthorized();

  const { id: rawId } = await params;
  const id = parseBookId(rawId);
  if (!id) return fail("invalid_id", "책 id 형식이 아니야.", 400);

  const port = createSupabaseBooksReadPort(supabase);
  const book = await getBookById(port, id);
  if (!book) return fail("book_not_found", "그 책을 찾을 수 없어.", 404);
  return ok({ book });
}
```

- [ ] **Step 5: 타입체크로 배선 확인**

Run: `npm run typecheck`
Expected: 에러 없음. (여기서 처음으로 전체 프로젝트 기준 타입 정합성을 본다 — Task 5의 부분 체크와 달리 `next typegen`이 만든 라우트 타입까지 포함된다.)

- [ ] **Step 6: Commit**

```bash
git add src/app/api/books src/modules/books/index.ts
git commit -m "feat(books): search/recommend/:id 라우트 핸들러 연결"
```

---

### Task 9: 스모크 스크립트 + package.json

**Files:**
- Create: `scripts/books-smoke.ts`
- Modify: `package.json` (`tsx` devDependency 추가, `books:smoke`/`test:books` 스크립트 추가 — ai 모듈이 이미 쓰는 것과 동일한 관례, 신규 도구 아님)

**Interfaces:**
- Consumes: `searchAndUpsertBooks`, `recommendBooks`, `getBookById`, `mockSource`, `BooksAdminPort`, `BooksReadPort`, `BookInsertRow` from `@/modules/books` 내부 파일

- [ ] **Step 1: package.json 수정**

`package.json`의 `"devDependencies"`에 `"tsx": "^4.23.13"` 추가, `"scripts"`에 아래 두 줄 추가:

```json
    "books:smoke": "node --conditions=react-server --env-file-if-exists=.env.local --import tsx scripts/books-smoke.ts",
    "test:books": "node --conditions=react-server --import tsx --test src/modules/books/schema.test.ts src/modules/books/server/tags.test.ts src/modules/books/server/response.test.ts src/modules/books/server/source.test.ts src/modules/books/server/search.test.ts src/modules/books/server/recommend.test.ts"
```

- [ ] **Step 2: 의존성 설치**

Run: `npm install`
Expected: `tsx`가 `node_modules`에 설치되고 `package-lock.json`이 갱신된다.

- [ ] **Step 3: 전체 유닛 테스트 한 번에 실행 (지금까지의 회귀 확인)**

Run: `npm run test:books`
Expected: 모든 테스트 PASS (schema 4 + tags 4 + response 4 + source 5 + search 4 + recommend 2 = 23개)

- [ ] **Step 4: 스모크 스크립트 작성**

```ts
// scripts/books-smoke.ts
/**
 * books 모듈 스모크 — `npm run books:smoke`
 *
 * 외부 키도 Supabase 연결도 없이, mock 소스 + 인메모리 포트로
 * search → recommend → detail 흐름이 계약대로 도는지 확인한다.
 * 실제 Supabase/국립중앙도서관 연결 확인은 이 스크립트의 범위가 아니다
 * (scripts/check-supabase.mjs, README 참고).
 */
import { randomUUID } from "node:crypto";

import type { Book } from "@/shared/types";
import {
  getBookById,
  mockSource,
  recommendBooks,
  searchAndUpsertBooks,
  type BookInsertRow,
  type BooksAdminPort,
  type BooksReadPort,
} from "@/modules/books";

class FakeBooksStore implements BooksAdminPort, BooksReadPort {
  private rows = new Map<string, Book>();

  async findByIsbn(isbn13: string): Promise<Book | null> {
    return [...this.rows.values()].find((b) => b.isbn13 === isbn13) ?? null;
  }

  async insertBook(row: BookInsertRow): Promise<Book> {
    const book: Book = {
      id: randomUUID(),
      isbn13: row.isbn13 ?? null,
      title: row.title,
      author: row.author,
      publisher: row.publisher,
      cover_url: row.cover_url ?? null,
      tags: row.tags ?? [],
      target_grade_min: row.target_grade_min ?? null,
      target_grade_max: row.target_grade_max ?? null,
      is_public_domain: row.is_public_domain ?? false,
      library_url: row.library_url ?? null,
      aladin_url: row.aladin_url ?? null,
    };
    this.rows.set(book.id, book);
    return book;
  }

  async listByGrade(gradeLevel: number, limit: number): Promise<Book[]> {
    return [...this.rows.values()]
      .filter(
        (b) =>
          (b.target_grade_min === null || b.target_grade_min <= gradeLevel) &&
          (b.target_grade_max === null || b.target_grade_max >= gradeLevel),
      )
      .sort((a, b) => a.title.localeCompare(b.title))
      .slice(0, limit);
  }

  async getById(id: string): Promise<Book | null> {
    return this.rows.get(id) ?? null;
  }
}

async function main() {
  const store = new FakeBooksStore();

  console.log("1) 검색: '아몬드'");
  const search1 = await searchAndUpsertBooks(store, mockSource, "아몬드");
  console.log(search1);

  console.log("\n2) 같은 검색 다시 (중복 insert 없이 기존 행을 반환해야 함)");
  const search2 = await searchAndUpsertBooks(store, mockSource, "아몬드");
  console.log(search2);
  if (search1.ok && search2.ok) {
    const same = search1.books[0]?.id === search2.books[0]?.id;
    console.log(`   같은 id 재사용: ${same ? "OK" : "FAIL"}`);
    if (!same) process.exitCode = 1;
  }

  console.log("\n3) 추천 (6학년)");
  console.log(await recommendBooks(store, 6));

  if (search1.ok && search1.books[0]) {
    console.log("\n4) 상세 조회");
    console.log(await getBookById(store, search1.books[0].id));
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
```

- [ ] **Step 5: Run smoke script**

Run: `npm run books:smoke`
Expected: 4단계 출력 모두 정상, "같은 id 재사용: OK" 출력, 에러 없이 종료(exit code 0).

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json scripts/books-smoke.ts
git commit -m "feat(books): 스모크 스크립트와 tsx 실행 스크립트 추가"
```

---

### Task 10: 최종 검증 및 PR

**Files:** 없음 (검증 전용)

- [ ] **Step 1: Lint**

Run: `npm run lint`
Expected: 에러 없음. (경고가 있으면 이 플랜에서 만든 파일에 한해 고친다 — 다른 파일 손대지 않는다.)

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: 에러 없음.

- [ ] **Step 3: Build (CI와 동일한 placeholder env로)**

```bash
NEXT_PUBLIC_SUPABASE_URL=https://placeholder.supabase.co \
NEXT_PUBLIC_SUPABASE_ANON_KEY=placeholder-anon-key \
NEXT_PUBLIC_SITE_URL=http://localhost:3000 \
ANSWER_WINDOW_SEC=45 \
PASS_THRESHOLD=moderate \
POINTS_PER_PASS=50 \
npm run build
```

Expected: 빌드 성공. (`NLK_API_KEY`/`DATA_GO_KR_KEY`/`SUPABASE_SERVICE_ROLE_KEY` 없이도 성공해야 한다 — `server/source.ts`와 `server/db.ts`가 이 값들을 함수 호출 시점에만 읽기 때문. 빌드가 이 값들이 없다고 실패하면 모듈 스코프에서 `process.env`를 읽는 코드가 있다는 뜻이니 함수 안으로 옮긴다.)

- [ ] **Step 4: 전체 테스트 다시 한 번**

Run: `npm run test:books && npm run books:smoke`
Expected: 전부 PASS.

- [ ] **Step 5: 브랜치 push 및 PR**

```bash
git push -u origin feat/books-search-recommend
gh pr create --title "feat(books): 검색·추천·상세 API" --body "$(cat <<'EOF'
## Summary
- GET /api/books/search, /recommend, /:id 를 실제로 구현 (docs/spec.md §5)
- 알라딘 API 종료(2026-09-04)로 국립중앙도서관/국립어린이청소년도서관 어댑터로 대체, 키 없으면 mock
- ai 모듈(normalizeGenreTags)과 shared/api가 main에 없어(별도 공유 예정인 main 브랜치 유실 이슈) 임시 대체 구현 후 TODO로 교체 지점 표시

## Follow-ups (팀 공유 필요)
- main 브랜치 유실 복구 (김민경) — docs/superpowers/specs/2026-09-14-books-search-recommend-design.md 참고
- ai 모듈 복구 후 server/tags.ts → ai.normalizeGenreTags 교체
- shared/api 복구 후 server/response.ts 제거
- 알라딘 종료가 rewards 모듈("알라딘 링크")에도 영향
- 국립중앙도서관/데이터go.kr 실제 인증키로 nlkSource/dataGoKrSource 검증 필요 (지금은 미검증)

## Test plan
- [x] npm run test:books (유닛 테스트 23개)
- [x] npm run books:smoke (mock 기반 end-to-end)
- [x] npm run lint / typecheck / build
- [ ] 실제 Supabase 환경에서 라우트 3개 수동 확인 (이 세션엔 .env 구성이 없어 못함 — 리뷰어가 로컬에서 확인)
EOF
)"
```

## Self-Review (완료됨 — 문서 작성 시점에 반영)

- **스펙 커버리지:** search/recommend/detail 3개 라우트, 어댑터 선택 규칙, 임시 태그 매핑, 임시 응답 헬퍼, 스모크 테스트 — 스펙의 "목표" 절 4개 항목 전부 태스크로 커버됨.
- **플레이스홀더 스캔:** 코드 내 TODO는 "ai 모듈 복구 후 교체", "국회도서관 URL 확인 후 채우기" 두 곳뿐이며, 둘 다 스펙의 "후속 작업"에 명시된 의도된 표시다.
- **타입 일관성:** `BooksAdminPort`/`BooksReadPort`/`BookInsertRow`/`SearchResult`/`RecommendResult` 이름과 시그니처가 Task 5~9 전체에서 동일하게 쓰였는지 확인함.
- **범위 점검:** `books` 모듈 하나로 한정, `HomeScreen.tsx`의 mock 연동 교체는 별도 플랜(추후 진행)으로 남겨둠 — 이번 플랜은 API 계층까지만.
