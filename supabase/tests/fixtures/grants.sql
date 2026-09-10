-- Supabase 기본 동작 재현: public 의 모든 테이블에 grant 를 열어두고
-- 실제 제한은 RLS 가 한다. 이걸 안 하면 아래 테스트가 RLS 가 아니라
-- 권한 부족으로 막혀서 거짓 통과가 난다.
grant all on all tables in schema public to anon, authenticated;
grant all on all sequences in schema public to anon, authenticated;
