-- 0008 — 채점 결과 기록 + 책갈피 적립을 한 트랜잭션으로
-- docs/spec.md §4, CLAUDE.md §4
--
-- ⚠️ 초안이다. supabase/migrations 는 김민경 소유라 (CLAUDE.md §2) 머지 전 확인이 필요하다.
--    verification 라우트가 이 함수 없이는 spec §4 의 "같은 트랜잭션" 요구를 만족할 수 없어
--    같이 올린다. 반대 의견이면 되돌리고 요청 이슈로 돌리겠다.
--
-- 왜 함수인가:
--   points_ledger 는 insert 정책이 없다 — service role 전용이다 (0004).
--   그리고 supabase-js 로는 verifications update 와 ledger insert 를 한 트랜잭션에
--   묶을 수 없다. 중간에 끊기면 "통과했는데 책갈피가 없는" 행이 남는다.
--
-- 왜 authenticated 에게 주지 않는가:
--   security definer 함수를 학생 역할에 열면, 브라우저에서 anon key 로 직접 rpc 를
--   불러 자기 시도를 마음대로 통과시키고 점수까지 정할 수 있다.
--   그래서 service_role 전용으로 두고, 인증된 Route Handler 만 호출한다.
--   소유권 확인은 함수 안에서 p_student_id 로 한 번 더 한다.

create or replace function record_verification_result(
  p_verification_id uuid,
  p_student_id      uuid,
  p_answer          text,
  p_logic           score_axis,
  p_specificity     score_axis,
  p_style           style_axis,
  p_passed          boolean,
  p_feedback        text,
  p_points          int
)
returns verifications
language plpgsql
security definer
set search_path = public
as $$
declare
  v verifications;
begin
  if p_points < 0 then
    raise exception '적립 책갈피는 음수일 수 없다: %', p_points
      using errcode = 'check_violation';
  end if;

  -- answered_at is null 조건이 이중 채점을 막는다.
  -- 같은 시도를 두 번 제출해도 두 번째는 여기서 걸린다.
  update verifications
     set answer            = p_answer,
         logic_consistency = p_logic,
         specificity       = p_specificity,
         style_consistency = p_style,
         passed            = p_passed,
         feedback          = p_feedback,
         points_awarded    = case when p_passed then p_points else 0 end,
         answered_at       = now()
   where id          = p_verification_id
     and student_id  = p_student_id
     and answered_at is null
  returning * into v;

  if v.id is null then
    raise exception '채점할 수 있는 시도가 아니다: %', p_verification_id
      using errcode = 'no_data_found';
  end if;

  -- 통과했을 때만 적립한다. 실패는 +0 행조차 남기지 않는다 —
  -- 원장은 실제 증감만 담고, 실패 기록은 verifications 행이 이미 갖고 있다 (CLAUDE.md §4).
  if v.passed then
    insert into points_ledger (student_id, delta, reason, ref_id)
    values (v.student_id, v.points_awarded, 'verification_pass', v.id)
    on conflict do nothing;  -- points_ledger_no_double_award
  end if;

  update reviews
     set status     = (case when v.passed then 'passed' else 'failed' end)::review_status,
         updated_at = now()
   where id = v.review_id;

  return v;
end;
$$;

comment on function record_verification_result is
  '채점 결과 기록 + 책갈피 적립 + 독후감 상태 변경을 한 트랜잭션으로 (docs/spec.md §4). '
  'service_role 전용 — authenticated 에게 열면 학생이 자기 시도를 스스로 통과시킬 수 있다.';

revoke all on function record_verification_result(
  uuid, uuid, text, score_axis, score_axis, style_axis, boolean, text, int
) from public;

grant execute on function record_verification_result(
  uuid, uuid, text, score_axis, score_axis, style_axis, boolean, text, int
) to service_role;

-- 남은 것 (문민재 · growth):
--   통과 시 streaks.current_days 와 genre_stamps.completed_count 도 같이 올라가야 한다.
--   growth 모듈의 소관이라 여기서는 건드리지 않았다. 지금은 시드값 그대로다.
