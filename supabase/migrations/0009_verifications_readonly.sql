-- 0009 — 학생은 verifications 를 읽기만, reviews.status 는 서버만 바꾼다
-- github issue #22, CLAUDE.md §4·§5, docs/spec.md §3
--
-- 0003 의 verifications_all_own 은 for all 이었다. 학생이 anon key 로 자기 행을
-- passed=true 로 직접 insert 할 수 있었고, v_class_ranking 과 v_teacher_student_progress 는
-- 그 값을 세므로 반 랭킹과 교사 진도가 조작됐다. asked_at 을 고치면 서버 타이머도 우회된다.
--
-- 쓰기는 전부 service_role 로 옮긴다:
--   시도 생성·asked_at 갱신  → verification 모듈이 admin 클라이언트로 (issue #22)
--   채점 기록               → record_verification_result (0008, service_role 전용)

drop policy verifications_all_own on verifications;

create policy verifications_select_own on verifications
  for select using (student_id = auth.uid());

-- ── reviews.status ───────────────────────────────────
-- 학생은 body 를 계속 써야 하니 정책을 좁힐 수 없다. 대신 컬럼 단위로 잠근다.
-- RLS 는 행 단위라 컬럼을 못 가리므로 (supabase/tests/README.md) 권한으로 막는다.
--
-- 상태 전이(draft → analyzing → questioning → passed/failed)는 submit 라우트와
-- record_verification_result 만 한다. 둘 다 service_role 이라 이 제한을 안 받는다.
--
-- Postgres 는 테이블 권한이 남아 있으면 컬럼 revoke 가 효과가 없다.
-- 테이블 권한을 통째로 걷고 필요한 컬럼만 다시 준다.

revoke insert, update on reviews from authenticated;

grant insert (student_id, book_id, body, char_count)         on reviews to authenticated;
grant update (body, char_count, is_shared, updated_at)       on reviews to authenticated;

comment on column reviews.status is
  '학생 역할은 이 컬럼을 쓸 수 없다 (0009). submit 라우트와 record_verification_result 가 service_role 로 바꾼다.';
