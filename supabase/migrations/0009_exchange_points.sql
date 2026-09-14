-- 0009 — 책갈피 교환(잔액 확인 + 차감)을 한 트랜잭션으로
-- docs/spec.md §4, §5 (POST /api/points/exchange)
--
-- ⚠️ 초안이다. supabase/migrations 는 김민경 소유라 (CLAUDE.md §2) 머지 전 확인이 필요하다.
--    0008 과 같은 이유로 같이 올린다 — points_ledger 는 insert 정책이 없고(0004),
--    supabase-js 로는 "잔액 확인 → insert" 를 한 트랜잭션으로 묶을 수 없다.
--    이 함수 없이는 같은 학생의 동시 교환 요청 두 개가 각각 "잔액 충분"으로 통과해
--    잔액이 음수로 내려갈 수 있다. 반대 의견이면 되돌리고 요청 이슈로 돌리겠다.
--
-- 왜 advisory lock 인가:
--   points_ledger 는 append-only 라 학생의 기존 행을 잠글 대상이 없을 수도 있다
--   (교환이 첫 지출인 경우). 그래서 student_id 를 키로 트랜잭션 advisory lock 을 걸어
--   같은 학생의 동시 호출을 직렬화한다 — 다른 학생 사이에는 영향이 없다.
--
-- 왜 authenticated 에게 주지 않는가:
--   security definer 함수를 학생 역할에 열면 브라우저에서 비용을 조작해 호출할 수 있다.
--   그래서 service_role 전용으로 두고, 인증된 Route Handler 만 호출한다.
--   소유권 확인은 함수 안에서 p_student_id 로 한 번 더 한다.
--   비용(300/450)은 함수 인자로 받되, 호출부(rewards 모듈)의 상수가 유일한 출처다 —
--   사용자 입력에서 바로 온 값이 아니다.

create or replace function exchange_points(
  p_student_id uuid,
  p_reason     point_reason,
  p_cost       int
)
returns points_ledger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_balance int;
  v_row     points_ledger;
begin
  if p_cost <= 0 then
    raise exception '교환 비용은 양수여야 한다: %', p_cost
      using errcode = 'invalid_parameter_value';
  end if;
  if p_reason not in ('ebook_pass', 'audiobook_pass') then
    raise exception '교환 사유가 아니다: %', p_reason
      using errcode = 'invalid_parameter_value';
  end if;

  -- 같은 학생의 동시 교환 요청을 직렬화한다. 잔액 확인과 차감 사이의 경쟁을 막는다.
  perform pg_advisory_xact_lock(hashtext(p_student_id::text));

  select coalesce(sum(delta), 0) into v_balance
    from points_ledger
   where student_id = p_student_id;

  if v_balance < p_cost then
    -- 이 코드로 라우트가 "잔액 부족"과 "서버 오류"를 구분한다 (CLAUDE.md §9).
    raise exception '책갈피가 모자라다: 잔액 %, 필요 %', v_balance, p_cost
      using errcode = 'check_violation';
  end if;

  insert into points_ledger (student_id, delta, reason, ref_id)
  values (p_student_id, -p_cost, p_reason, gen_random_uuid())
  returning * into v_row;

  return v_row;
end;
$$;

comment on function exchange_points is
  '책갈피 교환의 잔액 확인 + 차감을 한 트랜잭션으로 (docs/spec.md §4, §5). '
  'service_role 전용 — authenticated 에게 열면 학생이 비용을 조작해 부를 수 있다.';

revoke all on function exchange_points(uuid, point_reason, int) from public;

grant execute on function exchange_points(uuid, point_reason, int) to service_role;
