-- 0015 — curated 책에는 캐릭터가 자동으로 생긴다
-- docs/spec.md §2b: 캐릭터는 curated 책마다 한 마리. 0014 는 seed §7b 가 넣는 것만 전제했는데,
-- 서재는 reader:import 로 계속 늘어난다 (9/18 기준 curated 71권 중 9권이 캐릭터 없음).
-- 캐릭터 없는 책은 통과해도 도감에 안 들어가므로, books 쪽에서 기본 캐릭터를 만들어 둔다.
-- 이름은 제목에서 만든 임시값이다 — 강민구가 진화 로직을 붙이며 다듬는다.

create or replace function ensure_default_character() returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.curated then
    insert into characters (book_id, name, stage_names, art_seed)
    values (new.id,
            new.title || ' 요정',
            array['알', '아기 ' || new.title || ' 요정', new.title || ' 요정'],
            substr(md5(new.id::text), 1, 8))
    on conflict (book_id) do nothing;
  end if;
  return new;
end;
$$;

create trigger books_default_character
  after insert or update of curated on books
  for each row
  execute function ensure_default_character();

-- 백필: 이미 들어와 있는 curated 책
insert into characters (book_id, name, stage_names, art_seed)
select b.id,
       b.title || ' 요정',
       array['알', '아기 ' || b.title || ' 요정', b.title || ' 요정'],
       substr(md5(b.id::text), 1, 8)
  from books b
 where b.curated
on conflict (book_id) do nothing;
