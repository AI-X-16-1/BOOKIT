-- Supabase 기본 동작 재현: 테이블이 만들어질 때 anon/authenticated 에 grant 가 붙는다.
-- 실제 제한은 RLS 가 한다. 이걸 안 하면 아래 테스트가 RLS 가 아니라 권한 부족으로 막혀서
-- 거짓 통과가 난다.
--
-- 마이그레이션 **전** 에 default privileges 로 건다. 마이그레이션 뒤에 grant all 을 하면
-- 0009 처럼 마이그레이션 안에서 권한을 걷어낸 것까지 도로 열려 그 검사가 무의미해진다.
alter default privileges in schema public grant all on tables    to anon, authenticated;
alter default privileges in schema public grant all on sequences to anon, authenticated;
