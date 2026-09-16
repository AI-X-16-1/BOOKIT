-- scripts/cleanup-test-reviews.sql
-- 프리뷰·로컬에서 손으로 돌려 본 독후감을 지운다. Supabase SQL Editor 에 붙여 쓴다.
--
-- 지우는 것: 아래 EMAIL 계정이 최근에 쓴 독후감과 거기 딸린 빈틈·검증·책갈피.
-- 지우지 않는 것: 데모 시드(@bookit.demo)와 books·book_contents.
--   → 시드를 통째로 다시 깔고 싶으면 이 파일이 아니라 supabase/seed.sql 을 돌린다.
--
-- 순서가 중요하다: verifications.gap_id 가 on delete restrict 라(0003) review_gaps 를
-- 먼저 지우면 막힌다. verifications → review_gaps → reviews 순으로 간다.
--
-- 쓰는 법
--   1. §0 을 먼저 돌려 지워질 행을 눈으로 본다.
--   2. 맞으면 §1 을 돌린다. 숫자가 이상하면 commit 대신 rollback 을 친다.
--   3. 그 독후감이 "통과"까지 갔다면 §2 도 본다 (스트릭·도장이 올라가 있다).

-- ─────────────────────────────────────────────────────────────
-- §0. 먼저 확인 — 지워질 독후감
-- ─────────────────────────────────────────────────────────────
-- EMAIL 과 기간을 여기서 바꾼다. 기간을 넉넉히 잡으면 진짜 독후감까지 걸리니 좁게 둔다.
select r.id,
       r.status,
       r.created_at,
       b.title,
       left(r.body, 40) as body_앞부분,
       (select count(*) from review_gaps g where g.review_id = r.id)   as 빈틈,
       (select count(*) from verifications v where v.review_id = r.id) as 시도,
       (select count(*) from verifications v
         where v.review_id = r.id and v.passed)                        as 통과
  from reviews r
  join books b on b.id = r.book_id
 where r.student_id = (select id from auth.users where email = 'parkjg0525@gmail.com')
   and r.created_at >= now() - interval '1 day'
 order by r.created_at desc;

-- ─────────────────────────────────────────────────────────────
-- §1. 삭제
-- ─────────────────────────────────────────────────────────────
begin;

-- 지울 독후감을 임시 테이블에 담아 둔다 — 아래 delete 들이 같은 목록을 본다.
create temp table _doomed on commit drop as
select r.id
  from reviews r
 where r.student_id = (select id from auth.users where email = 'parkjg0525@gmail.com')
   and r.created_at >= now() - interval '1 day';

-- 1) 책갈피 원장. 통과 적립분만 지운다 (ref_id = verifications.id).
--    원장은 append-only 라 평소엔 지우지 않지만, 없던 일로 만드는 테스트 행이라 예외다.
delete from points_ledger
 where reason = 'verification_pass'
   and ref_id in (select id from verifications where review_id in (select id from _doomed));

-- 2) 검증 시도 → 3) 빈틈 → 4) 독후감
delete from verifications where review_id in (select id from _doomed);
delete from review_gaps   where review_id in (select id from _doomed);
delete from reviews       where id        in (select id from _doomed);

-- 숫자가 맞으면 commit, 아니면 rollback 을 친다.
commit;

-- ─────────────────────────────────────────────────────────────
-- §2. (선택) 통과까지 갔다면 — 스트릭·장르 도장
-- ─────────────────────────────────────────────────────────────
-- points_ledger 에 verification_pass 가 쌓일 때 트리거(0011)가 streaks·genre_stamps 를
-- 올린다. §1 은 원장 행만 지우므로 그 두 값은 그대로 남는다. 통과한 적이 없으면 건너뛴다.
--
-- 지금 값 보기:
--   select * from streaks      where student_id = (select id from auth.users where email = 'parkjg0525@gmail.com');
--   select * from genre_stamps where student_id = (select id from auth.users where email = 'parkjg0525@gmail.com')
--    order by completed_count desc;
--
-- 도장은 통과한 책의 태그마다 1씩 올라갔으니 같은 만큼 내린다 (책 id 를 채워 넣는다):
--   update genre_stamps
--      set completed_count = greatest(completed_count - 1, 0)
--    where student_id = (select id from auth.users where email = 'parkjg0525@gmail.com')
--      and genre = any (select unnest(tags) from books where id = '여기에-책-id');
--
-- 스트릭은 "연속 일수"라 되돌릴 값이 기록에 남지 않는다. 테스트 계정이면 그냥 두거나,
-- 원하는 값으로 직접 맞춘다:
--   update streaks set current_days = 0, longest_days = 0, last_passed_on = null
--    where student_id = (select id from auth.users where email = 'parkjg0525@gmail.com');

-- ─────────────────────────────────────────────────────────────
-- §3. 확인 — 0건이면 끝
-- ─────────────────────────────────────────────────────────────
select count(*) as 남은_테스트_독후감
  from reviews
 where student_id = (select id from auth.users where email = 'parkjg0525@gmail.com')
   and created_at >= now() - interval '1 day';
