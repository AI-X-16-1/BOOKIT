-- 0016 — 아이템 샵 (④ 스트레치): items, student_items, buy_item()
-- docs/spec.md §2b·§5b, docs/sprint-0918.md
--
-- 책갈피의 첫 소비처다. #58 에서 열람권 교환을 철회한 뒤 "앱 안에서 실제로 전달되는 보상" 으로
-- 정했던 것 — 캐릭터 꾸미기(모자·배경·액자). 화면·라우트는 rewards(문민재) 몫이고
-- 이 파일은 테이블·RLS·구매 트랜잭션만 깐다.
--
-- 불변식: points_ledger 는 append-only 그대로. 구매 = reason 'item_purchase', delta -price.
-- 잔액 확인과 차감은 exchange_points(0010)와 같은 방식으로 한 트랜잭션·advisory lock.

-- 새 enum 값. 이 파일 안에서는 이 값을 DML 로 쓰지 않는다 (같은 트랜잭션에서 새 enum 값을
-- 쓰면 Postgres 가 거부한다). 함수 본문의 리터럴은 실행 시점에 해석되므로 괜찮다.
alter type point_reason add value if not exists 'item_purchase';

create type item_kind as enum ('hat', 'bg', 'frame');

-- ── items — 카탈로그 ──────────────────────────────────

create table items (
  id         uuid primary key default gen_random_uuid(),
  code       text not null unique,
  name       text not null,
  kind       item_kind not null,
  -- 그림 대신 이모지·색으로 그린다 (characters.art_seed 와 같은 이유)
  emoji      text not null default '',
  price      int  not null check (price > 0),
  created_at timestamptz not null default now()
);

alter table items enable row level security;

create policy items_select_all on items
  for select to authenticated using (true);

-- ── student_items — 산 것 ─────────────────────────────

create table student_items (
  -- points_ledger.ref_id 가 이 id 를 가리킨다. (reason, ref_id) 유니크 인덱스(0004) 때문에
  -- item_id 를 ref_id 로 쓰면 두 학생이 같은 아이템을 못 산다 — 그래서 행마다 id 를 둔다
  id         uuid primary key default gen_random_uuid(),
  student_id uuid not null references profiles (id) on delete cascade,
  item_id    uuid not null references items (id) on delete cascade,
  bought_at  timestamptz not null default now(),
  unique (student_id, item_id)
);

alter table student_items enable row level security;

-- 읽기만 본인. 쓰기는 buy_item() 뿐 (service_role 전용)
create policy student_items_select_own on student_items
  for select using (student_id = auth.uid());

-- ── buy_item — 잔액 확인 + 차감 + 지급을 한 트랜잭션으로 ──

create or replace function buy_item(
  p_student_id uuid,
  p_item_id    uuid
)
returns student_items
language plpgsql
security definer
set search_path = public
as $$
declare
  v_price   int;
  v_balance int;
  v_row     student_items;
begin
  select price into v_price from items where id = p_item_id;
  if v_price is null then
    raise exception '그런 아이템은 없다: %', p_item_id
      using errcode = 'no_data_found';
  end if;

  -- 같은 학생의 동시 구매를 직렬화한다 (exchange_points 와 같다)
  perform pg_advisory_xact_lock(hashtext(p_student_id::text));

  if exists (select 1 from student_items
              where student_id = p_student_id and item_id = p_item_id) then
    raise exception '이미 가진 아이템이다'
      using errcode = 'unique_violation';
  end if;

  select coalesce(sum(delta), 0) into v_balance
    from points_ledger
   where student_id = p_student_id;

  if v_balance < v_price then
    -- 라우트가 "잔액 부족"과 "서버 오류"를 구분하는 코드 (0010 과 같다)
    raise exception '책갈피가 모자라다: 잔액 %, 필요 %', v_balance, v_price
      using errcode = 'check_violation';
  end if;

  insert into student_items (student_id, item_id)
  values (p_student_id, p_item_id)
  returning * into v_row;

  insert into points_ledger (student_id, delta, reason, ref_id)
  values (p_student_id, -v_price, 'item_purchase', v_row.id);

  return v_row;
end;
$$;

comment on function buy_item is
  '아이템 구매: 잔액 확인 + 차감 + 지급을 한 트랜잭션으로 (docs/spec.md §2b). '
  'service_role 전용 — 호출부(rewards)가 세션의 user.id 를 넘긴다. 가격은 items 에서만 읽는다.';

revoke all on function buy_item(uuid, uuid) from public;
grant execute on function buy_item(uuid, uuid) to service_role;

-- ── 카탈로그 (시드가 아니라 마이그레이션에 둔다 — 운영·테스트가 같은 목록을 가져야 한다) ──

insert into items (code, name, kind, emoji, price) values
  ('hat_leaf',    '나뭇잎 모자',   'hat',   '🍃', 100),
  ('hat_crown',   '작은 왕관',     'hat',   '👑', 300),
  ('bg_meadow',   '들판 배경',     'bg',    '🌾', 150),
  ('bg_night',    '별밤 배경',     'bg',    '🌌', 250),
  ('frame_wood',  '나무 액자',     'frame', '🪵', 120),
  ('frame_gold',  '금빛 액자',     'frame', '✨', 350)
on conflict (code) do nothing;
