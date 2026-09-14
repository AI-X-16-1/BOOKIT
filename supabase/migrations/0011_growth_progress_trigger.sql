-- 0011 — 통과 시 스트릭·장르 도장을 실제로 올린다
-- docs/spec.md §2 (streaks, genre_stamps), CLAUDE.md §3 (growth)
--
-- ⚠️ 초안이다. supabase/migrations 는 김민경 소유라 (CLAUDE.md §2) 머지 전 확인이 필요하다.
--    0008 이 남긴 TODO — "통과 시 streaks·genre_stamps 도 같이 올라가야 한다" — 를 채운다.
--    0008/0009/0010 과 같은 이유로 같이 올린다: points_ledger 에 verification_pass 행이
--    쌓이는 시점과 별개로 두 값을 갱신할 경로가 없으면 growth 화면이 시드값에서
--    멈춘 채로 뜬다.
--
-- 판단이 필요했던 두 가지:
--   1. 같은 날 여러 번 통과하면 스트릭을 몇 번 올리나 — 하루 1회로 캡한다.
--      (문민재 초안은 "매번 늘린다" 였으나, current_days 는 "연속 일수"라는 뜻을
--       teacher 뷰(streak 컬럼)·seed(7일 스트릭)와 공유한다 — 리뷰에서 김민경 제안대로
--       캡으로 정리했다. "하루에 여러 권 읽었다"는 leaves(완독 수)가 이미 보여준다.)
--   2. 책에 장르 태그가 여러 개면 도장을 어디에 올리나 — 태그 전부에 완독 1권씩 올린다.
--      (books.tags 는 앱이 정규화한 10-15개 중 여러 개가 붙을 수 있다, docs/plan.md §4-2)
--
-- 왜 트리거인가:
--   record_verification_result(0008)와 exchange_points(0010)를 건드리지 않고도
--   "verification_pass 행이 쌓이면" 이라는 지점에 끼워 넣을 수 있다. RPC 를 growth
--   소관 로직으로 어지럽히지 않는다 — points_ledger 에 쌓이는 모든 verification_pass
--   행이 트리거 하나만 거치면 된다.
--
-- 왜 안전한가:
--   이 트리거는 points_ledger insert 문이 실행되는 트랜잭션 안에서만 실행된다.
--   points_ledger 에 insert 정책이 없어(0004) 그 insert 자체가 이미 service role
--   경로(record_verification_result) 로만 일어난다 — 트리거도 같은 트랜잭션의
--   같은 권한으로 실행되므로 streaks·genre_stamps 에 별도 insert 정책을 열 필요가 없다.
--
-- 왜 KST 인가:
--   Supabase Postgres 의 current_date 는 UTC 다. 자정 근처(KST 아침 9시 전)에
--   통과하면 실제로는 오늘인데 어제 날짜로 찍혀 "오늘 이미 통과" 판정이 하루씩
--   밀린다. (now() at time zone 'Asia/Seoul')::date 로 KST 기준 오늘을 구한다.
--
-- seed.sql 은 이 트리거를 잠깐 꺼 두고(alter table ... disable trigger) 7일 스트릭·
-- 도장 6/4/3/2/1(docs/spec.md §7)을 직접 넣는다 — 실제 값과 시드 값이 섞이면 안 된다.

create or replace function bump_growth_on_pass() returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_book_id uuid;
  v_tags    text[];
  v_current int;
  v_longest int;
  v_last    date;
  v_today   date;
  v_tag     text;
begin
  if new.reason <> 'verification_pass' then
    return new;
  end if;

  v_today := (now() at time zone 'Asia/Seoul')::date;

  -- ── 스트릭: 하루 1회. current_days 는 "연속 일수" 라는 뜻을 유지한다 ──
  select current_days, longest_days, last_passed_on
    into v_current, v_longest, v_last
    from streaks
   where student_id = new.student_id
   for update;

  if v_last = v_today then
    -- 오늘 이미 셌다. 스트릭은 그대로 두고 장르 도장만 올린다.
    v_current := coalesce(v_current, 0);
    v_longest := coalesce(v_longest, 0);
  elsif v_last = v_today - 1 then
    v_current := coalesce(v_current, 0) + 1;
    v_longest := greatest(coalesce(v_longest, 0), v_current);
  else
    v_current := 1;
    v_longest := greatest(coalesce(v_longest, 0), 1);
  end if;

  insert into streaks (student_id, current_days, longest_days, last_passed_on)
  values (new.student_id, v_current, v_longest, v_today)
  on conflict (student_id) do update
    set current_days   = excluded.current_days,
        longest_days   = excluded.longest_days,
        last_passed_on = excluded.last_passed_on;

  -- ── 장르 도장: ref_id(=verification.id) 로 책을 찾아 태그 전부에 1권씩 올린다 ──
  select r.book_id into v_book_id
    from verifications v
    join reviews r on r.id = v.review_id
   where v.id = new.ref_id;

  if v_book_id is not null then
    select tags into v_tags from books where id = v_book_id;

    foreach v_tag in array v_tags loop
      insert into genre_stamps (student_id, genre, completed_count)
      values (new.student_id, v_tag, 1)
      on conflict (student_id, genre) do update
        set completed_count = genre_stamps.completed_count + 1;
    end loop;
  end if;

  return new;
end;
$$;

comment on function bump_growth_on_pass is
  '통과(verification_pass) 시 스트릭과 장르 도장을 올린다 (docs/spec.md §2). '
  '같은 날 두 번째부터는 스트릭을 올리지 않고(하루 1회), 책의 태그 전부에 도장 진행도가 붙는다. '
  'KST(Asia/Seoul) 기준 날짜로 판단한다.';

-- trigger 함수는 반환형이 trigger 라 PostgREST RPC 로 직접 호출할 수 없다
-- (트리거 컨텍스트 밖에서 부르면 언어 자체가 오류를 낸다) — 별도 revoke 가 필요 없다.

create trigger points_ledger_bump_growth
  after insert on points_ledger
  for each row
  execute function bump_growth_on_pass();
