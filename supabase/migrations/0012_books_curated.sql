-- 0012 — 추천 목록은 고른 책만 (books.curated)
-- docs/spec.md §5 GET /api/books/recommend, CLAUDE.md §3 (books)
--
-- 검색(GET /api/books/search)은 국립중앙도서관에서 받은 책을 books 에 그대로 저장한다.
-- 추천이 books 전체를 학년으로만 거르니, 누군가 검색한 만화·문제집이 다른 학생의
-- "이런 책은 어때?" 에 그대로 올라왔다 (프로덕션 2026-09-15). 추천 후보를 표시한다.
--
-- true 는 시드가 고른 책뿐이다. 검색으로 들어온 책은 기본값 false 라 추천에 안 나온다 —
-- 검색해서 고르는 것과 독후감 쓰는 것은 그대로 된다.

alter table books add column curated boolean not null default false;

comment on column books.curated is
  '추천 목록(GET /api/books/recommend) 후보. 시드가 고른 책만 true. 검색으로 저장된 책은 false.';

create index books_curated_idx on books (curated) where curated;

update books
   set curated = true
 where id::text like '0000b0%'
   and title not in ('harry', 'squirrel');
