-- 0002 — books, book_contents
-- docs/spec.md §2
--
-- 도서 데이터는 공용 카탈로그다. 로그인한 사람은 다 읽을 수 있다.
-- 쓰기는 service role 만 — 외부 API(알라딘/국중/국립어린이청소년) 동기화가
-- Route Handler 안에서 돈다. 클라이언트에서 직접 쓰지 않는다.

create table books (
  id               uuid primary key default gen_random_uuid(),
  -- 저작권 만료 텍스트는 null
  isbn13           text unique,
  title            text not null,
  author           text not null,
  publisher        text,
  -- 알라딘 image URL. 목업의 그라데이션은 자리표시자다 (CLAUDE.md §10)
  cover_url        text,
  -- 앱의 10~15개 장르 태그로 정규화된 값 (ai 모듈이 정규화)
  tags             text[] not null default '{}',
  target_grade_min int,
  target_grade_max int,
  -- true → 책잇 서재에서 읽을 수 있음
  is_public_domain boolean not null default false,
  -- 국회전자도서관 딥링크
  library_url      text,
  aladin_url       text,

  constraint grade_range_ordered
    check (target_grade_min is null or target_grade_max is null
           or target_grade_min <= target_grade_max)
);

create index books_tags_idx  on books using gin (tags);
create index books_title_idx on books (title);

alter table books enable row level security;

-- 저작권 만료 도서 전용 본문
create table book_contents (
  book_id    uuid not null references books (id) on delete cascade,
  chapter_no int  not null,
  title      text not null,
  body       text not null,
  primary key (book_id, chapter_no)
);

alter table book_contents enable row level security;

-- ── RLS ──────────────────────────────────────────────
-- 읽기만 연다. insert/update/delete 정책이 없으므로 service role 외에는 쓸 수 없다.

create policy books_select_all on books
  for select to authenticated using (true);

-- 저작권 만료 도서의 본문만 읽힌다. is_public_domain 이 false 면 본문 자체가 없어야 하지만,
-- 실수로 들어와도 이 조건이 막는다.
create policy book_contents_select_public_domain on book_contents
  for select to authenticated using (
    exists (select 1 from books b where b.id = book_id and b.is_public_domain)
  );
