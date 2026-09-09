-- 0003 — reviews, review_gaps, verifications + 교사용 집계 뷰
-- docs/spec.md §2, §3
--
-- 이 파일이 프라이버시의 핵심이다.
-- reviews.body 와 verifications.answer 는 학생 본인만 본다.
-- reviews.is_shared = true 로 학생이 직접 공개한 경우에만 예외 (CLAUDE.md §5).

create table reviews (
  id         uuid primary key default gen_random_uuid(),
  student_id uuid not null references profiles (id) on delete cascade,
  book_id    uuid not null references books (id)    on delete restrict,
  body       text not null default '',
  char_count int  not null default 0,
  status     review_status not null default 'draft',
  -- 학생이 직접 켠 공개 여부
  is_shared  boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index reviews_student_id_idx on reviews (student_id);
create index reviews_book_id_idx    on reviews (book_id);

-- (학생, 책) 당 활성 독후감 하나. 다시 읽으면 새 행을 만든다 (docs/spec.md §2).
-- 통과/실패로 끝난 건 활성이 아니므로 제외한다.
create unique index reviews_one_active_per_student_book
  on reviews (student_id, book_id)
  where status in ('draft', 'analyzing', 'questioning');

alter table reviews enable row level security;

-- ── review_gaps ──────────────────────────────────────
-- AI 호출 #2 의 결과. 학생이 고쳐 다시 제출하면 삭제 후 재생성한다.

create table review_gaps (
  id        uuid primary key default gen_random_uuid(),
  review_id uuid not null references reviews (id) on delete cascade,
  ord       int  not null check (ord between 1 and 3),
  -- 학생이 실제로 쓴 문장 원문
  quote     text not null,
  gap_type  gap_type not null,
  reason    text not null,

  unique (review_id, ord)
);

alter table review_gaps enable row level security;

-- ── verifications ────────────────────────────────────
-- 실패한 시도는 절대 지우지 않는다.
-- 재시도는 attempt_no + 1 로 새 행을 넣고, 가능하면 다른 gap 에서 새 질문을 만든다.

create table verifications (
  id                uuid primary key default gen_random_uuid(),
  review_id         uuid not null references reviews (id)      on delete cascade,
  -- RLS 속도를 위해 비정규화 (docs/spec.md §2)
  student_id        uuid not null references profiles (id)     on delete cascade,
  attempt_no        int  not null check (attempt_no >= 1),
  gap_id            uuid not null references review_gaps (id)  on delete restrict,
  question          text not null,
  answer            text,
  logic_consistency score_axis,
  specificity       score_axis,
  style_consistency style_axis,
  passed            boolean not null default false,
  feedback          text,
  -- 통과 50, 실패 0 (docs/spec.md §4)
  points_awarded    int not null default 0 check (points_awarded >= 0),
  -- 타이머의 진실의 원천. 클라이언트 카운트다운은 표시용일 뿐이다.
  -- asked_at 으로부터 ANSWER_WINDOW_SEC + 5초를 넘겨 도착한 답은 거부한다 (docs/spec.md §5).
  asked_at          timestamptz not null default now(),
  answered_at       timestamptz,

  unique (review_id, attempt_no)
);

create index verifications_student_id_idx on verifications (student_id);
create index verifications_review_id_idx  on verifications (review_id);

alter table verifications enable row level security;

-- ── RLS: reviews ─────────────────────────────────────

create policy reviews_all_own on reviews
  for all using (student_id = auth.uid()) with check (student_id = auth.uid());

-- 교사에게 여는 유일한 통로. 학생이 직접 공개한 독후감만이다.
-- 그 외에는 교사도 reviews 를 행 단위로 읽지 못한다 — 집계는 아래 뷰로만.
create policy reviews_select_shared_as_teacher on reviews
  for select using (is_shared and is_teacher_of(student_id));

-- ── RLS: review_gaps ─────────────────────────────────
-- 학생 본인만. 교사·보호자 모두 접근 없음 (docs/spec.md §3).

create policy review_gaps_all_own on review_gaps
  for all using (
    exists (select 1 from reviews r where r.id = review_id and r.student_id = auth.uid())
  ) with check (
    exists (select 1 from reviews r where r.id = review_id and r.student_id = auth.uid())
  );

-- ── RLS: verifications ───────────────────────────────
-- answer 컬럼 때문에 교사에게 행 단위 select 를 열지 않는다.
-- 교사가 보는 점수·통과 여부는 아래 뷰가 담당한다.

create policy verifications_all_own on verifications
  for all using (student_id = auth.uid()) with check (student_id = auth.uid());

-- ── 이해도 점수 ──────────────────────────────────────
-- 3축을 0-100 하나로 환산한다. 교사·보호자 화면과 랭킹이 이 값을 쓴다.

create or replace function comprehension_score(
  logic score_axis,
  spec  score_axis,
  style style_axis
)
returns int
language sql
immutable
as $$
  select round(
    100 * (
        (case logic when 'pass' then 1.0 when 'weak' then 0.5 else 0.0 end)
      + (case spec  when 'pass' then 1.0 when 'weak' then 0.5 else 0.0 end)
      + (case style when 'same' then 1.0 else 0.0 end)
    ) / 3
  )::int;
$$;

-- ── 교사용 뷰 ────────────────────────────────────────
--
-- Postgres RLS 는 행 단위라 "reviews 를 읽되 body 만 못 본다"를 정책으로 쓸 수 없다.
-- 그래서 교사에게는 위에서 행 접근 자체를 막고, 대신 필요한 컬럼만 담은 뷰를 준다.
--
-- security_invoker = false 는 의도적이고, 바꾸면 안 된다 (github issue #3).
-- true 로 바꾸려면 verifications 에 교사용 SELECT 정책이 필요한데,
-- RLS 는 컬럼을 가리지 못하므로 그 순간 교사가 answer 원문을 읽게 된다 — CLAUDE.md §5 위반이다.
-- 따라서 접근 통제는 뷰 정의문의 is_teacher_of() 필터가 전담한다.
--
-- 이 뷰를 고칠 때의 규칙:
--   1. where is_teacher_of() 필터를 지우지 않는다.
--   2. reviews.body, verifications.answer 등 학생 자유 서술 컬럼을 추가하지 않는다.
--   3. 컬럼을 추가할 때마다 위 둘을 다시 확인한다.
--
-- security_barrier: 사용자가 넘긴 함수가 is_teacher_of() 필터보다 먼저 평가되어
-- 남의 반 행을 엿보는 걸 막는다. definer 뷰에서는 이게 필터의 실질적인 뒷받침이다.

create view v_teacher_student_progress
with (security_invoker = false, security_barrier = true) as
select
  p.id                                        as student_id,
  p.display_name                              as name,
  count(*) filter (where v.passed)            as passed_count,
  coalesce(
    round(avg(comprehension_score(v.logic_consistency, v.specificity, v.style_consistency))
          filter (where v.passed))::int,
    0
  )                                           as avg_score,
  max(v.answered_at)                          as last_active
from profiles p
left join verifications v on v.student_id = p.id
where is_teacher_of(p.id)
group by p.id, p.display_name;

comment on view v_teacher_student_progress is
  '교사용 학생 진도. 독후감 본문과 답변 원문은 포함하지 않는다 (CLAUDE.md §5). '
  'security definer 유지 필수 — invoker 로 바꾸면 교사가 verifications.answer 를 읽게 된다.';

-- ── 반 랭킹 뷰 ───────────────────────────────────────
--
-- 교사 대시보드와 학생 마이페이지의 반 순위가 함께 쓴다. 그래서 이름에 teacher 를 붙이지 않는다.
--
-- 여기서도 security_invoker = false 는 의도적이다. classes 는 RLS 상
-- 교사에게 자기 반, 학생에게 소속 반만 보이므로 invoker 로 돌리면
-- "반 대 반" 이라는 기능 자체가 성립하지 않는다.
-- 대신 개인 식별 정보를 담지 않는 것이 이 뷰의 계약이다 — 학생 단위 컬럼을 추가하지 않는다.

create view v_class_ranking
with (security_invoker = false) as
select
  c.id                                     as class_id,
  c.school_name || ' ' || c.grade_level || '학년 ' || c.class_no || '반' as label,
  -- AI 검증을 통과한 완독만 집계한다 (docs/plan.md §4)
  count(v.id) filter (where v.passed)      as verified_count
from classes c
left join class_members cm on cm.class_id = c.id
left join verifications v  on v.student_id = cm.student_id
group by c.id, c.school_name, c.grade_level, c.class_no;

comment on view v_class_ranking is
  '반 대 반 랭킹 집계. 교사·학생 양쪽이 쓴다. 개인 순위와 학생 식별 컬럼은 노출하지 않는다. '
  '전체 반이 대상이라 별도 필터 없음.';

grant select on v_teacher_student_progress to authenticated;
grant select on v_class_ranking            to authenticated;
