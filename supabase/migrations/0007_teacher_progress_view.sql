-- 0007 — 교사 진도뷰에 class_id·streak 추가
-- docs/spec.md §5 (GET /api/teacher/students)
--
-- 계약이 요구하는 rows[] 는 name, passed_count, avg_score, streak, last_active 인데
-- 0003 의 뷰에는 streak 이 없었다. streaks 테이블은 RLS 상 학생 본인만 읽으므로
-- (0004 streaks_select_own) 교사가 직접 조회할 수 없다 — 뷰에 넣어야 한다.
--
-- class_id 는 반이 둘 이상인 교사를 위해서다. 뷰에 반 구분이 없으면
-- 두 반의 집계가 한 덩어리로 섞인다.
--
-- 0003 의 규칙은 그대로다:
--   1. where is_teacher_of() 필터를 지우지 않는다.
--   2. reviews.body, verifications.answer 등 학생 자유 서술 컬럼을 추가하지 않는다.
--   3. security_invoker = false 를 유지한다 (github issue #3).
--
-- create or replace view 는 기존 컬럼의 이름·순서·타입을 바꿀 수 없다. 뒤에 덧붙이기만 한다.

create or replace view v_teacher_student_progress
with (security_invoker = false, security_barrier = true) as
select
  p.id                                        as student_id,
  p.display_name                              as name,
  count(*) filter (where v.passed)            as passed_count,
  coalesce(
    round(avg(comprehension_score(v.logic_consistency, v.specificity, v.style_consistency))
          filter (where v.passed))::int,
    0
  )                                           as avg_score,
  max(v.answered_at)                          as last_active,
  cm.class_id                                 as class_id,
  -- streaks 는 학생당 한 행이라 max() 로 집계해도 값이 그대로다
  coalesce(max(s.current_days), 0)            as streak
from profiles p
left join verifications v  on v.student_id = p.id
left join class_members cm on cm.student_id = p.id
left join streaks s        on s.student_id = p.id
where is_teacher_of(p.id)
group by p.id, p.display_name, cm.class_id;

comment on view v_teacher_student_progress is
  '교사용 학생 진도. 독후감 본문과 답변 원문은 포함하지 않는다 (CLAUDE.md §5). '
  'security definer 유지 필수 — invoker 로 바꾸면 교사가 verifications.answer 를 읽게 된다.';
