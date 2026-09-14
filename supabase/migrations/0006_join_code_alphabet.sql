-- 0006 — join_code 알파벳 제약
-- docs/spec.md §2 (classes.join_code)
--
-- 코드에 쓰는 32자에는 헷갈리는 0/O/1/I 가 빠져 있다. 0001 의 generate_join_code() 는
-- 그 규칙을 지키지만, 규칙이 함수 안에만 있어서 직접 insert 하는 경로(시드·운영 스크립트)는
-- 그냥 통과했다. 실제로 seed.sql 이 'HB5002' 처럼 0 이 든 코드를 넣고 있었고,
-- 그 코드는 온보딩 입력 검증(modules/auth/schema.ts)에서 거부된다 —
-- 데모 학생이 시드된 반에 못 들어가는 상태였다.
--
-- 규칙을 테이블에 못박아 둔다. 이제 어느 경로로 넣어도 같은 알파벳만 통과한다.

alter table classes
  add constraint classes_join_code_alphabet
  check (join_code ~ '^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$');

comment on constraint classes_join_code_alphabet on classes is
  '헷갈리는 0/O/1/I 를 뺀 32자 알파벳. generate_join_code() 및 온보딩 입력 검증과 같은 규칙.';
