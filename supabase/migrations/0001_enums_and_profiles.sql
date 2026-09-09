-- 0001 — enums, profiles, classes, class_members
-- docs/spec.md §1, §2, §3
--
-- 정책은 테이블을 만드는 마이그레이션 안에 같이 쓴다. RLS 를 나중으로 미루지 않는다 (CLAUDE.md §5).
--
-- force row level security 는 쓰지 않는다: 테이블 소유자(postgres)까지 정책 대상이 되어
-- 마이그레이션과 seed.sql 삽입이 막힌다. service_role 은 BYPASSRLS 속성으로 어차피 우회한다.

-- ── enums ────────────────────────────────────────────

create type profile_role   as enum ('student', 'teacher');
create type review_status  as enum ('draft', 'analyzing', 'questioning', 'passed', 'failed');
create type gap_type       as enum ('unsupported_claim', 'vague_statement', 'feeling_only');
create type point_reason   as enum ('verification_pass', 'ebook_pass', 'audiobook_pass', 'admin_adjust');
create type challenge_kind as enum ('class_goal', 'season');
create type score_axis     as enum ('pass', 'weak', 'fail');
create type style_axis     as enum ('same', 'shifted');

-- ── profiles ─────────────────────────────────────────

create table profiles (
  id           uuid primary key references auth.users (id) on delete cascade,
  role         profile_role not null default 'student',
  display_name text         not null,
  -- 1=초1 … 6=초6, 7=중1, 8=중2, 9=중3. 교사는 null
  grade_level  int          check (grade_level between 1 and 9),
  created_at   timestamptz  not null default now(),

  constraint students_have_grade
    check (role = 'teacher' or grade_level is not null)
);

alter table profiles enable row level security;

-- ── classes ──────────────────────────────────────────

create table classes (
  id          uuid primary key default gen_random_uuid(),
  teacher_id  uuid not null references profiles (id) on delete cascade,
  school_name text not null,
  grade_level int  not null,
  class_no    int  not null,
  join_code   char(6) not null unique,
  created_at  timestamptz not null default now()
);

create index classes_teacher_id_idx on classes (teacher_id);

alter table classes enable row level security;

-- 헷갈리는 글자(0/O/1/I)를 뺀 32자 알파벳으로 6자리 코드를 만든다.
-- 학교/학급 자유 입력은 허용하지 않는다 — 아무나 남의 반 데이터를 읽게 된다 (CLAUDE.md §4).
create or replace function generate_join_code()
returns char(6)
language plpgsql
security definer
set search_path = public
as $$
declare
  alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  code     char(6);
begin
  loop
    code := '';
    for _i in 1..6 loop
      code := code || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
    end loop;
    exit when not exists (select 1 from classes where join_code = code);
  end loop;
  return code;
end;
$$;

-- ── class_members ────────────────────────────────────

create table class_members (
  class_id   uuid not null references classes (id) on delete cascade,
  student_id uuid not null references profiles (id) on delete cascade,
  joined_at  timestamptz not null default now(),
  primary key (class_id, student_id)
);

-- 학생은 활성 학급을 최대 하나만 가진다 (docs/spec.md §2)
create unique index class_members_one_class_per_student on class_members (student_id);

alter table class_members enable row level security;

-- ── 헬퍼 ─────────────────────────────────────────────
--
-- 정책 안에서 테이블을 다시 읽으면 재귀 평가에 걸린다.
-- security definer 로 감싸 RLS 를 우회시키고, search_path 를 고정해 둔다.

create or replace function my_class_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select class_id from class_members where student_id = auth.uid() limit 1;
$$;

-- 내가 소유한 반에 이 학생이 있는가
create or replace function is_teacher_of(target_student uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from class_members cm
    join classes c on c.id = cm.class_id
    where cm.student_id = target_student
      and c.teacher_id  = auth.uid()
  );
$$;

-- ── RLS: profiles ────────────────────────────────────

create policy profiles_select_own on profiles
  for select using (id = auth.uid());

-- 교사는 자기 반 학생의 이름·학년만 필요하다.
-- 컬럼 제한은 RLS 로 표현할 수 없어서, 실제 조회는 0003 의 뷰를 쓴다.
-- 이 정책은 그 뷰(security invoker)가 통과하기 위한 최소 권한이다.
create policy profiles_select_my_students on profiles
  for select using (is_teacher_of(id));

create policy profiles_insert_self on profiles
  for insert with check (id = auth.uid());

create policy profiles_update_own on profiles
  for update using (id = auth.uid()) with check (id = auth.uid());

-- ── RLS: classes ─────────────────────────────────────

create policy classes_select_own_as_teacher on classes
  for select using (teacher_id = auth.uid());

-- 학생은 자기가 속한 반만 읽는다
create policy classes_select_own_as_student on classes
  for select using (id = my_class_id());

create policy classes_insert_as_teacher on classes
  for insert with check (
    teacher_id = auth.uid()
    and exists (select 1 from profiles where id = auth.uid() and role = 'teacher')
  );

create policy classes_update_own on classes
  for update using (teacher_id = auth.uid()) with check (teacher_id = auth.uid());

create policy classes_delete_own on classes
  for delete using (teacher_id = auth.uid());

-- ── RLS: class_members ───────────────────────────────

create policy class_members_select_own on class_members
  for select using (student_id = auth.uid());

create policy class_members_select_as_teacher on class_members
  for select using (
    exists (select 1 from classes c where c.id = class_id and c.teacher_id = auth.uid())
  );

-- 학생이 join_code 로 직접 들어온다. 코드 검증은 Route Handler 가 한다
-- (코드 → class_id 변환에는 classes 전체 조회가 필요한데, 학생에게는 그 권한이 없다).
create policy class_members_insert_self on class_members
  for insert with check (student_id = auth.uid());

create policy class_members_delete_own on class_members
  for delete using (student_id = auth.uid());
