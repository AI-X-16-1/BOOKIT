-- 0005 — guardian_links
-- docs/spec.md §2, §3
--
-- 보호자는 계정이 없다. 토큰 하나로 한 학생의 결과만 읽는다.
--
-- 중요: 익명(anon) 정책을 만들지 않는다.
-- GET /api/guardian/:token 은 service role 로 도는 Route Handler 안에서 조회하고,
-- service role 은 BYPASSRLS 로 RLS 자체를 우회한다. 브라우저에서 직접 쿼리하지 않는다.
-- anon 에게 정책을 열면 토큰을 모르는 사람도 테이블을 훑을 수 있게 된다.
--
-- 그 핸들러가 보호자에게 돌려주는 것: 완독 여부, 책갈피, 이해도 점수, 책 목록.
-- 독후감 본문(reviews.body)과 답변 원문(verifications.answer)은 절대 포함하지 않는다 (CLAUDE.md §5).

create table guardian_links (
  -- 32자 이상 랜덤. 생성은 Route Handler 가 한다
  token      text primary key check (length(token) >= 32),
  student_id uuid not null references profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  revoked_at timestamptz
);

create index guardian_links_student_id_idx on guardian_links (student_id);

-- 살아 있는 링크는 학생당 하나만
create unique index guardian_links_one_active_per_student
  on guardian_links (student_id)
  where revoked_at is null;

alter table guardian_links enable row level security;

-- 학생 본인만 자기 링크를 보고, 만들고, 끊는다.
create policy guardian_links_select_own on guardian_links
  for select using (student_id = auth.uid());

create policy guardian_links_insert_own on guardian_links
  for insert with check (student_id = auth.uid());

-- 끊기는 revoked_at 을 채우는 update 다. 행을 지우지 않는다.
create policy guardian_links_revoke_own on guardian_links
  for update using (student_id = auth.uid()) with check (student_id = auth.uid());
