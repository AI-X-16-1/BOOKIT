-- 0014 — 게임화: characters, student_characters, reading_progress, checkpoints, profiles.explorer_rank
-- docs/spec.md §2b·§5b, docs/sprint-0918.md (2026-09-18)
--
-- 불변식: AI 검증 파이프라인 · 책갈피 지급(points_ledger, record_verification_result) · 기존 RLS 는
-- 건드리지 않는다. 이 파일은 새 테이블과 그 위의 트리거만 더한다.
--
-- 진화 3단계 (spec §2b 가정):
--   stage 0 알     — 책을 펼쳐 첫 장을 읽으면 (reading_progress 첫 행)
--   stage 1 부화   — 체크포인트 하나를 통과하거나, 마지막 장까지 읽으면
--   stage 2 최종   — 독후감 검증 통과 (points_ledger 에 verification_pass 가 쌓일 때)
-- stage 는 내려가지 않는다 (greatest). 전부 DB 트리거로 올린다 — 0011 과 같은 방식이라
-- 검증 응답 시간에 얹히지 않고, 학생 클라이언트에 update 정책을 열 필요가 없다.
--
-- 캐릭터는 책 한 권에 한 마리, curated 책(시드 15권 + 서재)에만 있다 (seed.sql 이 넣는다).
-- 검색으로 들어온 책은 캐릭터가 없고, 그 책의 통과는 캐릭터 없이 책갈피만 준다 — 종전과 같다.

-- ── characters — 카탈로그 ─────────────────────────────

create table characters (
  id          uuid primary key default gen_random_uuid(),
  book_id     uuid not null unique references books (id) on delete cascade,
  name        text not null,
  -- 알 → 1단계 → 2단계 이름. 정확히 3개
  stage_names text[] not null check (array_length(stage_names, 1) = 3),
  -- 그림이 없다. 표지 그라데이션(COVER) 위에 이모지·색으로 그린다. 화면이 해석한다
  art_seed    text not null default '',
  created_at  timestamptz not null default now()
);

alter table characters enable row level security;

-- 카탈로그는 누구나 읽는다 (도감·보스전 화면)
create policy characters_select_all on characters
  for select to authenticated using (true);

-- ── student_characters — 학생이 가진 캐릭터 ───────────

create table student_characters (
  student_id  uuid not null references profiles (id) on delete cascade,
  book_id     uuid not null references books (id) on delete cascade,
  stage       smallint not null default 0 check (stage between 0 and 2),
  obtained_at timestamptz not null default now(),
  evolved_at  timestamptz,
  primary key (student_id, book_id)
);

alter table student_characters enable row level security;

-- 읽기만 본인. 쓰기는 전부 트리거(security definer) — 학생이 자기 캐릭터를 진화시킬 수 없다
create policy student_characters_select_own on student_characters
  for select using (student_id = auth.uid());

-- ── reading_progress — 서재 읽기 기록 = 표지 퍼즐 조각 ──

create table reading_progress (
  student_id uuid not null references profiles (id) on delete cascade,
  book_id    uuid not null references books (id) on delete cascade,
  chapter_no int  not null check (chapter_no >= 1),
  read_at    timestamptz not null default now(),
  primary key (student_id, book_id, chapter_no)
);

alter table reading_progress enable row level security;

create policy reading_progress_select_own on reading_progress
  for select using (student_id = auth.uid());

-- 장 끝에 닿으면 리더가 본인 권한으로 넣는다. 같은 장은 on conflict do nothing (upsert 없음 — 갱신할 게 없다)
create policy reading_progress_insert_own on reading_progress
  for insert with check (student_id = auth.uid());

-- ── checkpoints — 장 끝 한 문항 (AI #6) ───────────────

create table checkpoints (
  id          uuid primary key default gen_random_uuid(),
  student_id  uuid not null references profiles (id) on delete cascade,
  book_id     uuid not null references books (id) on delete cascade,
  chapter_no  int  not null check (chapter_no >= 1),
  question    text not null,
  answer      text,
  passed      boolean,
  feedback    text,
  asked_at    timestamptz not null default now(),
  answered_at timestamptz,
  -- 학생·책·장당 하나. 다시 물으면 같은 행을 돌려준다 (spec §5b)
  unique (student_id, book_id, chapter_no),
  constraint answered_together
    check ((answer is null) = (answered_at is null))
);

alter table checkpoints enable row level security;

-- verifications 와 같다: 학생은 읽기만, 질문·판정은 service role 이 쓴다 (AI 가 만든다)
create policy checkpoints_select_own on checkpoints
  for select using (student_id = auth.uid());

-- ── profiles.explorer_rank — 탐험가 등급 (온보딩 자기 선언) ──

alter table profiles
  add column explorer_rank text
    check (explorer_rank in ('새싹', '탐험가', '대장'));

comment on column profiles.explorer_rank is
  '온보딩에서 학생이 고르는 탐험가 등급. 화면 톤에만 쓴다 — 학년(grade_level)을 대체하지 않는다 (spec §2b).';

-- ── 진화 트리거 ───────────────────────────────────────

-- stage 를 올린다. 캐릭터가 없는 책(검색 유입분)이면 아무것도 하지 않는다. 내려가지 않는다.
create or replace function raise_character_stage(p_student uuid, p_book uuid, p_stage smallint)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (select 1 from characters where book_id = p_book) then
    return;
  end if;

  insert into student_characters (student_id, book_id, stage, evolved_at)
  values (p_student, p_book, p_stage, case when p_stage > 0 then now() end)
  on conflict (student_id, book_id) do update
    set stage      = greatest(student_characters.stage, excluded.stage),
        evolved_at = case
                       when excluded.stage > student_characters.stage then now()
                       else student_characters.evolved_at
                     end;
end;
$$;

revoke all on function raise_character_stage(uuid, uuid, smallint) from public;

-- 첫 장을 읽으면 알. 마지막 장까지 읽으면 부화.
create or replace function character_on_progress() returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_total int;
  v_read  int;
begin
  perform raise_character_stage(new.student_id, new.book_id, 0::smallint);

  select count(*) into v_total from book_contents where book_id = new.book_id;
  select count(*) into v_read
    from reading_progress
   where student_id = new.student_id and book_id = new.book_id;

  if v_total > 0 and v_read >= v_total then
    perform raise_character_stage(new.student_id, new.book_id, 1::smallint);
  end if;

  return new;
end;
$$;

create trigger reading_progress_character
  after insert on reading_progress
  for each row
  execute function character_on_progress();

-- 체크포인트를 통과하면 부화.
create or replace function character_on_checkpoint() returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.passed is true and (old.passed is distinct from true) then
    perform raise_character_stage(new.student_id, new.book_id, 1::smallint);
  end if;
  return new;
end;
$$;

create trigger checkpoints_character
  after update of passed on checkpoints
  for each row
  execute function character_on_checkpoint();

-- 검증 통과(책갈피 적립)하면 최종 진화. 0011 의 트리거는 손대지 않고 옆에 하나 더 건다.
create or replace function character_on_pass() returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_book_id uuid;
begin
  if new.reason <> 'verification_pass' then
    return new;
  end if;

  select r.book_id into v_book_id
    from verifications v
    join reviews r on r.id = v.review_id
   where v.id = new.ref_id;

  if v_book_id is not null then
    perform raise_character_stage(new.student_id, v_book_id, 2::smallint);
  end if;

  return new;
end;
$$;

create trigger points_ledger_character
  after insert on points_ledger
  for each row
  execute function character_on_pass();
