# books 모듈 — 검색·추천·상세 설계

Owner: 이승환. Status: approved (2026-09-14).

## 배경

`books` 모듈은 지금 mock 데이터(`BOOKS` 배열 5권)만 있고 실제 API가 없다. 이 문서는
`docs/spec.md` §5에 이미 고정된 API 계약(`GET /api/books/search`, `/recommend`, `/:id`)을
실제로 구현하기 위한 설계다.

### 이 설계에 영향을 준 두 가지 발견

1. **`main` 브랜치 유실**: GitHub PR은 다수(#13 ai-prompts, #17 teacher-dashboard-api,
   #18 auth-pwa, #20 verification-api, #21 review-api, #24 seed-sql-editor 등)가
   MERGED 상태지만, 실제 `main`(`b207a05`) 히스토리엔 그 커밋들이 없다 — 각 브랜치의
   커밋은 origin에 그대로 남아 있으므로 데이터 유실은 아니고, `main`이 과거 시점으로
   되돌아간 것으로 보인다. 이 복구는 `shared`/배포 소유자(김민경) 영역이라 이 작업
   범위에 포함하지 않는다. 결과적으로 `ai` 모듈(`normalizeGenreTags`)과
   `shared/api`(응답 헬퍼)가 지금 `main`엔 없다 — 아래 설계는 이 전제 위에서 간다.
2. **알라딘 API 서비스 종료(2026-09-04)**: `docs/spec.md`·`CLAUDE.md`가 전제한 "표지·검색은
   알라딘"이 더 이상 성립하지 않는다. 국립중앙도서관 API를 주 소스로 대체한다
   (사용자 확인 완료). 표지 이미지는 못 받을 가능성이 높고, 그 경우 기존 그라데이션
   placeholder(`CoverTone`)를 그대로 쓴다 — 스키마 변경 없음.

## 목표

- `GET /api/books/search?q=` — 국립중앙도서관에서 실시간 검색, 결과를 `books` 테이블에
  적재(같은 책으로 독후감을 쓰려면 FK가 걸리는 행이 있어야 함).
- `GET /api/books/recommend` — 로그인 학생의 학년 + 태그 겹침 기준 단순 목록.
  장르 인접 추천 고도화는 범위 밖 (CLAUDE.md §11 컷 순서와 일치, 나중에 확장).
- `GET /api/books/:id` — `books` 테이블 단순 조회.
- API 키 없이도(지금 상태) 개발·리뷰 가능해야 한다.

## 비목표 (지금은 안 함)

- 개인 독서 이력 기반 정교한 장르 인접 추천.
- `ai.normalizeGenreTags` 연동 (모듈 부재 — 임시 대체 후 TODO로 표시).
- `shared/api` 공용 응답 헬퍼 사용 (부재 — 모듈 내부 임시 버전).
- 국회도서관(국회전자도서관) 실제 API 연동 — `library_url`은 검색 딥링크 URL 조립만,
  인증·API 호출 없음.
- 알라딘 재통합, 카카오/네이버 등 대체 소스 추가 — 어댑터 인터페이스만 열어둔다.

## 아키텍처

```
src/modules/books/
  server/
    source.ts       # BookSource 인터페이스 + nlkSource / dataGoKrSource / mockSource + getBookSource()
    tags.ts         # 임시 장르 태그 매핑 (docs/prompts.md §5 고정 15개 태그 복제)
    response.ts     # 모듈 내부 { data } / { error } 응답 헬퍼 (shared/api 대체용, 임시)
    search.ts       # searchAndUpsertBooks(query) — 소스 조회 → 매핑 → isbn13 기준 upsert
    recommend.ts    # recommendBooks(gradeLevel) — DB 필터
    detail.ts       # getBookById(id) — DB 단순 조회
  schema.ts         # zod 쿼리 파라미터 검증 (q, id)
  components/HomeScreen.tsx   (기존, 변경 없음)
  mock.ts           # 유지 — mockSource가 재사용
  index.ts          # public export 갱신

src/app/api/books/
  search/route.ts
  recommend/route.ts
  [id]/route.ts

scripts/books-smoke.ts   # mock 소스 기준 동작 확인 스크립트
```

### BookSource 인터페이스

```ts
interface RawBookHit {
  isbn13: string | null;
  title: string;
  author: string;
  publisher: string | null;
  coverUrl: string | null;
  rawCategory: string | null;   // 태그 매핑 입력
  kdc: string | null;           // 태그 매핑 입력
}

interface BookSource {
  search(query: string): Promise<RawBookHit[]>;
}
```

(추천은 외부 소스를 다시 부르지 않고 이미 적재된 `books` 테이블만 조회한다 — 아래
"추천 로직" 참고. 그래서 `BookSource`엔 검색 메서드 하나만 있으면 된다.)

`getBookSource()` 선택 규칙:
1. `NLK_API_KEY` 있으면 `nlkSource`.
2. 없고 `DATA_GO_KR_KEY`만 있으면 `dataGoKrSource`.
3. 둘 다 없으면 `mockSource` (지금 상태 — 개발용).

실제 키가 있는데 호출이 실패(네트워크/타임아웃/비정상 응답)하면 **mock으로 조용히
폴백하지 않는다** — `{ error: { code: "book_source_unavailable", message } }`를 그대로
반환한다. 운영 중 장애를 숨기지 않기 위함. 폴백은 오직 "키가 아예 없을 때"만.

### 검색 → 적재 흐름

1. `q` 검증 (빈 문자열/공백만이면 `{ books: [] }` 즉시 반환).
2. `source.search(q)` 호출.
3. 결과 각각을 `Book` 모양으로 매핑 (`tags`는 `tags.ts`의 임시 매핑 사용).
4. `isbn13`이 있는 항목: **기존 행이 있으면 그대로 반환(덮어쓰지 않음)**, 없으면
   service role 클라이언트로 insert. 시드로 큐레이션된 행을 실수로 덮지 않기 위함
   (`supabase/migrations/0002_books.sql`이 "쓰기는 service role만"으로 이미 설계해둠).
5. `isbn13`이 없는 항목은 매 검색마다 새로 insert하지 않고 응답에만 포함 (중복 방지 —
   국립중앙도서관 결과는 ISBN이 거의 항상 있으므로 실무 영향 적음).

### 추천 로직 (MVP)

로그인 유저 → `profiles.grade_level` 조회 → `books`에서
`target_grade_min <= grade <= target_grade_max` (null은 열려있는 것으로 취급) 필터,
제목 가나다순 정렬로 최대 10개 (`books` 테이블에 `created_at`이 없어 등록순 정렬이
불가능함을 구현 중 확인 — 결정론적이고 구현이 단순한 제목순으로 대체). `reason_tags`는
결과에 나타난 태그의 합집합 (화면에 "이래서 추천했어" 보여주기용, 지금은 단순 표시).

### 장르 태그 임시 매핑 (`tags.ts`)

`docs/prompts.md` §5의 고정 태그를 그대로 복제 (문자열 리터럴 출처는 이 문서, 새 태그
발명 금지): 성장소설, 판타지, SF, 추리, 동화, 역사, 과학, 모험, 우정, 인물심리, 가족,
사회, 자연, 예술, 고전.

`mapToGenreTags(rawCategory, kdc)`: 카테고리 문자열 키워드 매칭 + KDC 대분류 코드
매핑(800번대 한국문학 등)으로 최대 4개 태그 반환, 확신 없으면 빈 배열.

`ai` 모듈이 `main`에 복구되면 이 함수를 지우고 `ai.normalizeGenreTags`로 교체 —
호출부(`search.ts`) 시그니처는 동일하게 유지해서 교체 지점을 한 곳으로 좁혀둔다.
소스 상단에 `// TODO(ai 모듈 복구 후 교체): docs/prompts.md §5 normalizeGenreTags로 이관`
주석을 남긴다.

### 응답 헬퍼 (`response.ts`, 임시)

`shared/api`의 `ok/fail/invalidBody/unauthorized/readJson`과 동일한 시그니처의 최소
버전을 `books/server/response.ts`에 로컬로 둔다. `shared/`는 건드리지 않는다.
`shared/api`가 복구되면 이 파일을 지우고 import만 `@/shared/api`로 바꾸는 것으로 끝나게,
함수 이름과 반환 타입을 동일하게 맞춘다.

### 국회도서관 handoff

`library_url`은 국회전자도서관 검색 딥링크로 채울 계획이었으나, 정확한 검색 URL
패턴(도메인·쿼리 파라미터)을 확인할 방법이 이 세션엔 없다 — 잘못된 URL을 학생에게
보여주는 것보다 비워두는 쪽이 안전하다. `buildLibraryUrl(title, isbn13)` 함수를
`server/search.ts`에 별도로 분리해두고 지금은 `null`을 반환하게 하며, 실제 URL 구조를
확인하는 대로 그 함수 내부만 채우면 되도록 한다 (호출부는 변경 불필요). API 키·인증은
필요 없다는 전제(스펙상 검색 페이지 딥링크일 뿐)는 유지. `aladin_url`은 알라딘 종료로
항상 `null` (스키마는 이미 nullable — 변경 없음).

## 에러 처리

- 인증 없음 → `unauthorized()` (401).
- `q` 누락/공백 → 빈 배열 반환 (에러 아님 — 사용자가 타이핑 중일 수 있음).
- 외부 소스 장애(키 있는데 실패) → `fail("book_source_unavailable", ...)`.
- DB insert 실패 → `fail("book_save_failed", ...)`, 검색 결과 자체는 화면에 보여주되
  "이 책은 아직 저장에 문제가 있어" 정도로 후속 안내 (화면 쪽은 review 모듈 담당이라
  여기선 에러 코드만 명확히 내려준다).

## 테스트

vitest/jest 없는 레포 컨벤션(ai 모듈의 `scripts/ai-smoke.ts` 패턴)을 따라
`scripts/books-smoke.ts`를 추가: mock 소스로 search/recommend/detail 각각 호출해
콘솔에 결과 출력 + 태그 매핑 함수 단독 케이스 몇 개. `pnpm typecheck`, `pnpm lint` 통과
확인을 완료 기준에 포함한다.

## 후속 작업 (이 스펙 범위 밖, 팀에 공유 필요)

- `main` 브랜치 유실 복구 (김민경).
- `ai` 모듈 복구 후 `tags.ts` → `ai.normalizeGenreTags` 교체.
- `shared/api` 복구 후 `books/server/response.ts` 제거.
- 알라딘 종료가 `rewards`(문민재, "알라딘 링크") 모듈에도 영향 — 별도 공유 필요.
- 국립중앙도서관 API 인증키 신청 (신청 문구는 대화 내 별도 전달됨).
- 국회전자도서관 실제 검색 딥링크 URL 패턴 확인 후 `buildLibraryUrl` 채우기.
