-- 0004 — points_ledger, streaks, genre_stamps, challenges, challenge_progress
-- docs/spec.md §2, §4

-- ── points_ledger ────────────────────────────────────
-- Append-only. 잔액 컬럼은 없다 — 잔액 = sum(delta) (CLAUDE.md §4).
-- update/delete 정책을 만들지 않는 것으로 append-only 를 강제한다.

create table points_ledger (
  id         uuid primary key default gen_random_uuid(),
  student_id uuid not null references profiles (id) on delete cascade,
  -- 부호 있는 값. 통과 +50, ebook 열람권 −300, 오디오북 −450
  delta      int  not null check (delta <> 0),
  reason     point_reason not null,
  -- verification.id 또는 교환 행 id
  ref_id     uuid,
  created_at timestamptz not null default now()
);

create index points_ledger_student_id_idx on points_ledger (student_id, created_at desc);

-- 같은 verification 으로 두 번 적립하지 못하게 막는다 (docs/spec.md §4).
-- ref_id 가 없는 admin_adjust 는 대상에서 제외.
create unique index points_ledger_no_double_award
  on points_ledger (reason, ref_id)
  where ref_id is not null;

alter table points_ledger enable row level security;

-- 적립·차감은 verification/교환 행과 같은 트랜잭션 안에서 일어난다.
-- 학생 클라이언트가 직접 넣을 일이 없으므로 insert 정책도 열지 않는다 — service role 전용.
create policy points_ledger_select_own on points_ledger
  for select using (student_id = auth.uid());

-- ── streaks ──────────────────────────────────────────

create table streaks (
  student_id     uuid primary key references profiles (id) on delete cascade,
  current_days   int  not null default 0,
  longest_days   int  not null default 0,
  last_passed_on date
);

alter table streaks enable row level security;

create policy streaks_select_own on streaks
  for select using (student_id = auth.uid());

-- ── genre_stamps ─────────────────────────────────────
-- 완독 3권 = 도장 1개 (docs/spec.md §2)

create table genre_stamps (
  student_id      uuid not null references profiles (id) on delete cascade,
  genre           text not null,
  completed_count int  not null default 0 check (completed_count >= 0),
  primary key (student_id, genre)
);

alter table genre_stamps enable row level security;

create policy genre_stamps_select_own on genre_stamps
  for select using (student_id = auth.uid());

-- ── challenges ───────────────────────────────────────

create table challenges (
  id        uuid primary key default gen_random_uuid(),
  kind      challenge_kind not null,
  -- class_goal 은 반에 매인다. season 은 전체 공용이라 null
  class_id  uuid references classes (id) on delete cascade,
  title     text not null,
  target    int  not null check (target > 0),
  starts_on date not null,
  ends_on   date not null,

  constraint class_goal_has_class
    check (kind <> 'class_goal' or class_id is not null),
  constraint dates_ordered
    check (starts_on <= ends_on)
);

alter table challenges enable row level security;

-- 시즌 챌린지는 모두에게, 반 목표는 그 반 학생에게만
create policy challenges_select_visible on challenges
  for select to authenticated using (
    class_id is null or class_id = my_class_id()
  );

create table challenge_progress (
  challenge_id uuid not null references challenges (id) on delete cascade,
  student_id   uuid not null references profiles (id)   on delete cascade,
  value        int  not null default 0 check (value >= 0),
  primary key (challenge_id, student_id)
);

alter table challenge_progress enable row level security;

create policy challenge_progress_select_own on challenge_progress
  for select using (student_id = auth.uid());

-- 반 목표는 반 전체 합계를 봐야 하므로, 같은 반 학생끼리는 진행값을 읽을 수 있다.
-- 이름은 붙지 않는다 — 개인 순위를 만들지 않기 위해서다 (docs/plan.md §4).
create policy challenge_progress_select_classmates on challenge_progress
  for select using (
    exists (
      select 1 from class_members cm
      where cm.student_id = challenge_progress.student_id
        and cm.class_id = my_class_id()
    )
  );
