-- supabase/seed.sql — 데모용 시드 데이터
-- docs/spec.md §7 요구사항: 교사 1명, 한빛초 5학년 2반, 학생 약 24명,
-- 데모 학생의 독후감 12개, 완독 3권, 7일 스트릭, 1,240 책갈피,
-- 반 랭킹 5개 반, 저작권 만료 도서 3~5권 + 본문.
--
-- 실행: supabase db reset (마이그레이션 0001~0005 적용 후 자동으로 이 파일이 돈다)
-- postgres 권한으로 돈다는 전제다 — auth.users 에 직접 넣기 때문이다.
-- 여러 번 돌려도 되게 만들었다: 맨 위에서 데모 데이터를 먼저 지우고 시작한다.
--
-- ─────────────────────────────────────────────────────────────────────────
-- 확인 필요 (→ 김민경) 2건
--
-- 1. 이해도 점수 92 / 88 / 95 는 현재 스키마로 만들 수 없다.
--    0003 의 comprehension_score() 는 3개 축(pass/weak/fail, same/shifted)에서
--    계산하므로 나올 수 있는 값이 {0, 17, 33, 50, 67, 83, 100} 뿐이다.
--    시드에서 임의의 숫자를 넣으면 v_teacher_student_progress 의 계산값과
--    화면 숫자가 따로 논다. 그래서 여기서는 100 / 83 / 100 으로 넣었다.
--    spec.md §7 의 92/88/95 를 그대로 쓰려면 verifications 에 수치 score 컬럼을
--    따로 두거나, 채점 루브릭을 더 잘게 쪼개야 한다. 스키마 결정 사항이라 남겨둔다.
--
-- 2. 저작권 만료 도서의 본문(book_contents.body)은 자리표시자다.
--    실제 원문을 기억에 의존해 쓰면 실존 작가의 글로 잘못된 텍스트가 박히게 되므로
--    넣지 않았다. 위키문헌(ko.wikisource.org)에서 받아 채워야 한다. → 강민구
-- ─────────────────────────────────────────────────────────────────────────

begin;

-- ── 0. 기존 데모 데이터 정리 ─────────────────────────
-- verifications.gap_id 가 on delete restrict 라 cascade 순서에 기대면 막힌다.
-- 의존 순서대로 명시적으로 지운다.

-- 데모 계정은 전부 @bookit.demo 메일이다. 중간 테이블 없이 서브쿼리로 고른다 (SQL Editor 호환).
delete from verifications      where student_id in (select id from auth.users where email like '%@bookit.demo');
delete from review_gaps        where review_id in (
  select id from reviews where student_id in (select id from auth.users where email like '%@bookit.demo'));
delete from reviews            where student_id in (select id from auth.users where email like '%@bookit.demo');
delete from points_ledger      where student_id in (select id from auth.users where email like '%@bookit.demo');
delete from streaks            where student_id in (select id from auth.users where email like '%@bookit.demo');
delete from genre_stamps       where student_id in (select id from auth.users where email like '%@bookit.demo');
delete from guardian_links     where student_id in (select id from auth.users where email like '%@bookit.demo');
delete from challenge_progress where student_id in (select id from auth.users where email like '%@bookit.demo');
delete from challenges         where class_id in (
  select id from classes where teacher_id in (select id from auth.users where email like '%@bookit.demo'));
-- 고정 id 로 넣는 행은 id 로도 지운다 (시즌 챌린지는 class_id 가 null 이라 위 조건에 안 걸린다).
delete from challenges         where id::text like '0000e0%';
delete from classes            where id::text like '0000d0%';
delete from class_members      where student_id in (select id from auth.users where email like '%@bookit.demo');
delete from classes            where teacher_id in (select id from auth.users where email like '%@bookit.demo');
delete from profiles           where id in (select id from auth.users where email like '%@bookit.demo');
delete from auth.users         where id in (select id from auth.users where email like '%@bookit.demo');

delete from book_contents where book_id in (
  select id from books where id::text like '0000b0%');
delete from books where id::text like '0000b0%';

-- ── 1. 도서 ──────────────────────────────────────────
-- 앞의 4권이 저작권 만료 도서(책잇 서재에서 읽힘), 나머지는 일반 도서.
-- cover_url 은 비워둔다 — 실제 표지는 알라딘 API image URL 에서 온다 (CLAUDE.md §10).

insert into books (id, isbn13, title, author, publisher, tags,
                   target_grade_min, target_grade_max, is_public_domain,
                   library_url, aladin_url) values
  ('0000b001-0000-4000-8000-000000000001', null, '운수 좋은 날',        '현진건', null, '{"고전","한국소설"}',        7, 9, true,  null, null),
  ('0000b002-0000-4000-8000-000000000002', null, '메밀꽃 필 무렵',      '이효석', null, '{"고전","한국소설"}',        7, 9, true,  null, null),
  ('0000b003-0000-4000-8000-000000000003', null, '봄봄',                '김유정', null, '{"고전","한국소설","성장"}', 6, 9, true,  null, null),
  ('0000b004-0000-4000-8000-000000000004', null, '벙어리 삼룡이',        '나도향', null, '{"고전","한국소설"}',        7, 9, true,  null, null),

  ('0000b005-0000-4000-8000-000000000005', '9788936434267', '아몬드',        '손원평',   '창비',       '{"성장","한국소설"}',       6, 9, false, null, null),
  ('0000b006-0000-4000-8000-000000000006', '9788936456788', '완득이',        '김려령',   '창비',       '{"성장","한국소설"}',       6, 9, false, null, null),
  ('0000b007-0000-4000-8000-000000000007', '9788932917245', '마당을 나온 암탉', '황선미', '사계절',     '{"동화","성장"}',           3, 6, false, null, null),
  ('0000b008-0000-4000-8000-000000000008', '9788936477196', '나의 라임오렌지나무', '조제 마우루', '동녘', '{"성장","외국소설"}',     5, 8, false, null, null),
  ('0000b009-0000-4000-8000-000000000009', '9788932473901', '어린 왕자',      '생텍쥐페리', '문학동네', '{"고전","외국소설","철학"}', 4, 9, false, null, null),
  ('0000b010-0000-4000-8000-000000000010', '9788937460449', '동물농장',       '조지 오웰',  '민음사',   '{"고전","외국소설","사회"}', 7, 9, false, null, null),
  ('0000b011-0000-4000-8000-000000000011', '9788954429870', 'harry',         '데모 저자',  '데모출판',  '{"판타지","외국소설"}',     4, 8, false, null, null),
  ('0000b012-0000-4000-8000-000000000012', '9788937834011', '갈매기의 꿈',    '리처드 바크', '현문미디어', '{"성장","외국소설"}',     5, 9, false, null, null),
  ('0000b013-0000-4000-8000-000000000013', '9788934972464', '우리들의 일그러진 영웅', '이문열', '다림', '{"한국소설","사회"}',      7, 9, false, null, null),
  ('0000b014-0000-4000-8000-000000000014', '9788956055732', 'squirrel',      '데모 저자',  '데모출판',  '{"과학","교양"}',           5, 8, false, null, null),
  ('0000b015-0000-4000-8000-000000000015', '9788947542524', '몽실 언니',      '권정생',    '창비',      '{"역사","한국소설"}',       5, 8, false, null, null);

-- 저작권 만료 도서 본문.
-- ⚠️ 아래 body 는 전부 자리표시자다. 실제 원문으로 교체해야 한다 (위 헤더 주석 2번 참고).
insert into book_contents (book_id, chapter_no, title, body)
select
  b.id,
  ch.n,
  ch.n || '장',
  '[시드 자리표시자] ' || b.title || ' ' || ch.n || '장 본문이 들어갈 자리입니다. ' ||
  '실제 원문은 위키문헌(ko.wikisource.org)에서 받아 채워 주세요. ' ||
  '이 문단은 서재 화면의 본문 조판(18px / line-height 2)과 ' ||
  '단어 탭 사전 동작을 확인할 수 있을 만큼의 길이를 만들기 위한 더미 텍스트입니다. ' ||
  '문장이 여러 개 이어질 때 줄바꿈과 여백이 어떻게 보이는지, ' ||
  '긴 문단이 스크롤되는지 확인하는 용도로만 쓰입니다.'
from books b
cross join (select generate_series(1, 3) as n) ch
where b.is_public_domain;

-- ── 2. 교사 · 학급 ───────────────────────────────────
-- Google OAuth 전용이라 비밀번호는 쓰지 않는다 (CLAUDE.md §1).
-- encrypted_password 는 빈 문자열로 둔다.

do $$
declare
  v_teacher_id uuid;
  v_class_id   uuid;
  v_class_no   int;
begin
  for v_class_no in 1..5 loop
    v_teacher_id := ('0000c001-0000-4000-8000-00000000000' || v_class_no)::uuid;
    v_class_id   := ('0000d001-0000-4000-8000-00000000000' || v_class_no)::uuid;

    insert into auth.users (
      instance_id, id, aud, role, email, encrypted_password,
      email_confirmed_at, created_at, updated_at,
      raw_app_meta_data, raw_user_meta_data,
      confirmation_token, recovery_token, email_change_token_new, email_change
    ) values (
      '00000000-0000-0000-0000-000000000000', v_teacher_id,
      'authenticated', 'authenticated',
      'teacher' || v_class_no || '@bookit.demo', '',
      now(), now() - interval '60 days', now(),
      '{"provider":"google","providers":["google"]}',
      jsonb_build_object('full_name', '교사' || v_class_no),
      '', '', '', ''
    );

    insert into profiles (id, role, display_name, grade_level, created_at)
    values (v_teacher_id, 'teacher', '교사' || v_class_no, null,
            now() - interval '60 days');

    insert into classes (id, teacher_id, school_name, grade_level, class_no,
                         join_code, created_at)
    -- 코드 알파벳에는 0/O/1/I 가 없다 (0006 의 check 제약).
    -- 반 번호는 숫자 대신 글자로 붙인다: 1반 → HBCLSA … 5반 → HBCLSE
    values (v_class_id, v_teacher_id, '한빛초', 5, v_class_no,
            'HBCLS' || chr(64 + v_class_no),
            now() - interval '60 days');
  end loop;
end $$;

-- ── 3. 학생 ──────────────────────────────────────────
-- 2반 24명(데모 학생 포함), 나머지 반 20명씩.
-- 데모 학생은 고정 UUID 라 다른 시드 블록에서 참조하기 쉽다.

do $$
declare
  v_surnames  text[] := array['김','이','박','최','정','강','조','윤','장','임','한','오','서','신','권','황','안','송','류','전'];
  v_given     text[] := array['서준','서연','도윤','지우','시우','하윤','주원','지유','건우','채원','우진','수아','선우','지아','현우','다은','유준','예린','정우','소율','민재','하린','준호','나연'];
  v_class_id  uuid;
  v_student   uuid;
  v_count     int;
  i           int;
  c           int;
begin
  for c in 1..5 loop
    v_class_id := ('0000d001-0000-4000-8000-00000000000' || c)::uuid;
    v_count    := case when c = 2 then 24 else 20 end;

    for i in 1..v_count loop
      -- 2반 1번은 데모 학생 고정
      if c = 2 and i = 1 then
        v_student := '0000a001-0000-4000-8000-000000000001';
      else
        v_student := gen_random_uuid();
      end if;

      insert into auth.users (
        instance_id, id, aud, role, email, encrypted_password,
        email_confirmed_at, created_at, updated_at,
        raw_app_meta_data, raw_user_meta_data,
        confirmation_token, recovery_token, email_change_token_new, email_change
      ) values (
        '00000000-0000-0000-0000-000000000000', v_student,
        'authenticated', 'authenticated',
        case when c = 2 and i = 1 then 'demo@bookit.demo'
             else 'student-' || c || '-' || i || '@bookit.demo' end,
        '',
        now(), now() - interval '50 days', now(),
        '{"provider":"google","providers":["google"]}',
        jsonb_build_object('full_name',
          v_surnames[1 + ((c * 7 + i) % array_length(v_surnames, 1))] ||
          v_given[1 + ((c * 5 + i) % array_length(v_given, 1))]),
        '', '', '', ''
      );

      insert into profiles (id, role, display_name, grade_level, created_at)
      values (
        v_student, 'student',
        case when c = 2 and i = 1 then '민서'
             else v_surnames[1 + ((c * 7 + i) % array_length(v_surnames, 1))] ||
                  v_given[1 + ((c * 5 + i) % array_length(v_given, 1))] end,
        5, now() - interval '50 days'
      );

      insert into class_members (class_id, student_id, joined_at)
      values (v_class_id, v_student, now() - interval '50 days');
    end loop;
  end loop;
end $$;

-- ── 4. 데모 학생의 독후감 12개 ───────────────────────
-- 완독(통과) 3권 + 실패 2건(재시도 유도) + 진행 중 1건 + 나머지는 통과 이력.
-- 목업 2의 "아몬드" 독후감 본문을 그대로 쓴다.

do $$
declare
  v_student  uuid := '0000a001-0000-4000-8000-000000000001';
  v_review   uuid;
  v_gap      uuid;
  v_verif    uuid;
  v_books    uuid[] := array[
    '0000b005-0000-4000-8000-000000000005',  -- 아몬드      → 통과 100
    '0000b006-0000-4000-8000-000000000006',  -- 완득이      → 통과  83
    '0000b007-0000-4000-8000-000000000007',  -- 마당을 나온 암탉 → 통과 100
    '0000b008-0000-4000-8000-000000000008',
    '0000b009-0000-4000-8000-000000000009',
    '0000b010-0000-4000-8000-000000000010',
    '0000b011-0000-4000-8000-000000000011',
    '0000b012-0000-4000-8000-000000000012',
    '0000b013-0000-4000-8000-000000000013',
    '0000b014-0000-4000-8000-000000000014',
    '0000b015-0000-4000-8000-000000000015',
    '0000b001-0000-4000-8000-000000000001'
  ]::uuid[];
  v_body     text;
  v_status   review_status;
  v_logic    score_axis;
  v_spec     score_axis;
  v_style    style_axis;
  v_passed   boolean;
  i          int;
begin
  for i in 1..12 loop
    -- 1~3번: 완독(통과). 4~9번: 통과 이력. 10~11번: 실패. 12번: 작성 중.
    v_status := case
      when i <= 9  then 'passed'::review_status
      when i <= 11 then 'failed'::review_status
      else 'draft'::review_status
    end;

    v_body := case
      when i = 1 then
        '이 책에서 가장 기억에 남는 부분은 곤이와 윤재가 다시 만나는 장면이다. ' ||
        '나는 처음에 윤재가 감정을 잘 느끼지 못한다는 설정이 단순히 특이한 캐릭터를 ' ||
        '위한 장치라고 생각했는데, 읽다 보니 그게 오히려 다른 사람들의 감정을 더 ' ||
        '정확히 관찰하게 만드는 이유가 된다는 걸 알게 됐다. 주인공은 결국 변화했다.'
      when i = 12 then
        '오늘부터 이 책을 읽기 시작했다. 아직 앞부분밖에 못 읽었는데'
      else
        '이 책을 읽으면서 인물이 처한 상황이 계속 마음에 걸렸다. ' ||
        '처음에는 단순한 이야기라고 생각했는데, 뒤로 갈수록 인물이 왜 그런 선택을 ' ||
        '했는지 이해가 되기 시작했다. 특히 중반부의 한 장면에서 생각이 바뀌었다.'
    end;

    v_review := gen_random_uuid();

    insert into reviews (id, student_id, book_id, body, char_count, status,
                         is_shared, created_at, updated_at)
    values (v_review, v_student, v_books[i], v_body, length(v_body), v_status,
            false, now() - (i || ' days')::interval,
            now() - (i || ' days')::interval);

    continue when v_status = 'draft';

    -- 빈틈 3개 (AI 호출 #2 결과. 목업 2의 문구를 그대로 쓴다)
    v_gap := gen_random_uuid();
    insert into review_gaps (id, review_id, ord, quote, gap_type, reason) values
      (v_gap, v_review, 1, '주인공은 결국 변화했다.',
       'unsupported_claim', '어느 장면을 근거로 했는지 없어요');
    insert into review_gaps (id, review_id, ord, quote, gap_type, reason) values
      (gen_random_uuid(), v_review, 2, '여러 사건이 있었다.',
       'vague_statement', '어떤 사건인지 특정되지 않았어요');
    insert into review_gaps (id, review_id, ord, quote, gap_type, reason) values
      (gen_random_uuid(), v_review, 3, '감동적이었다.',
       'feeling_only', '인물·장면 연결이 없어요');

    v_passed := (v_status = 'passed');

    -- 점수 축. 통과 1·3번은 만점(100), 2번은 83, 나머지 통과는 100.
    if v_passed then
      v_logic := 'pass'; v_style := 'same';
      v_spec  := case when i = 2 then 'weak' else 'pass' end;
    else
      v_logic := 'weak'; v_spec := 'fail'; v_style := 'same';
    end if;

    v_verif := gen_random_uuid();
    insert into verifications (
      id, review_id, student_id, attempt_no, gap_id, question, answer,
      logic_consistency, specificity, style_consistency, passed, feedback,
      points_awarded, asked_at, answered_at
    ) values (
      v_verif, v_review, v_student, 1, v_gap,
      '"주인공은 결국 변화했다"고 썼는데, 어느 장면을 보고 그렇게 생각했어?',
      case when v_passed
        then '곤이가 윤재한테 처음으로 먼저 말을 거는 장면에서요. ' ||
             '그 전까지는 윤재가 항상 먼저 다가갔는데 그 장면만 반대였어요.'
        else '그냥 마지막에 그런 느낌이 들었어요.' end,
      v_logic, v_spec, v_style, v_passed,
      case when v_passed
        then '장면을 딱 집어서 말해줘서 좋았어! 네가 왜 그렇게 봤는지 잘 전해졌어.'
        else '조금만 더! 어느 장면인지 하나만 골라서 말해주면 훨씬 분명해질 거야.' end,
      case when v_passed then 50 else 0 end,
      now() - (i || ' days')::interval,
      now() - (i || ' days')::interval + interval '38 seconds'
    );

    -- 실패한 건에는 재시도 이력을 하나 더 남긴다.
    -- 재시도는 항상 다른 gap 에서 새 질문을 만든다 (CLAUDE.md §6).
    if not v_passed then
      insert into verifications (
        review_id, student_id, attempt_no, gap_id, question, answer,
        logic_consistency, specificity, style_consistency, passed, feedback,
        points_awarded, asked_at, answered_at
      )
      select
        v_review, v_student, 2, g.id,
        '"여러 사건이 있었다"고 했는데, 그중에 제일 기억에 남는 건 뭐야?',
        '음… 잘 모르겠어요.',
        'fail', 'fail', 'same', false,
        '괜찮아, 다시 해보자. 책에서 한 장면만 떠올려서 이야기해줄래?',
        0,
        now() - (i || ' days')::interval + interval '2 minutes',
        now() - (i || ' days')::interval + interval '2 minutes 41 seconds'
      from review_gaps g where g.review_id = v_review and g.ord = 2;
    end if;
  end loop;
end $$;

-- ── 5. 나머지 학생들의 통과 이력 (반 랭킹용) ─────────
-- 반 랭킹 뷰는 class_members 를 타고 passed 인 verifications 를 센다.
-- 반별 목표치를 정해두고 학생들에게 라운드로빈으로 뿌린다.
-- 2반은 데모 학생이 이미 9개를 채웠으므로 그만큼 뺀다 → 2반이 1위로 보인다.

do $$
declare
  v_targets  int[] := array[38, 52, 41, 29, 47];  -- 1반 … 5반
  v_class_id uuid;
  v_students uuid[];
  v_remain   int;
  v_review   uuid;
  v_gap      uuid;
  v_book     uuid;
  c          int;
  k          int;
begin
  for c in 1..5 loop
    v_class_id := ('0000d001-0000-4000-8000-00000000000' || c)::uuid;

    select array_agg(cm.student_id order by cm.student_id)
      into v_students
      from class_members cm
     where cm.class_id = v_class_id
       and cm.student_id <> '0000a001-0000-4000-8000-000000000001';

    -- 데모 학생이 이미 만든 통과 9건을 2반 목표에서 제외
    v_remain := v_targets[c] - case when c = 2 then 9 else 0 end;

    for k in 1..v_remain loop
      v_book := ('0000b0' || lpad((1 + (k % 15))::text, 2, '0') ||
                 '-0000-4000-8000-0000000000' ||
                 lpad((1 + (k % 15))::text, 2, '0'))::uuid;

      v_review := gen_random_uuid();
      insert into reviews (id, student_id, book_id, body, char_count, status,
                           is_shared, created_at, updated_at)
      values (
        v_review,
        v_students[1 + (k % array_length(v_students, 1))],
        v_book,
        '반 랭킹 집계를 위한 시드 독후감입니다. 화면에 직접 노출되지 않습니다.',
        36, 'passed', false,
        now() - ((k % 30) || ' days')::interval,
        now() - ((k % 30) || ' days')::interval
      );

      v_gap := gen_random_uuid();
      insert into review_gaps (id, review_id, ord, quote, gap_type, reason)
      values (v_gap, v_review, 1, '인상 깊었다.', 'feeling_only',
              '인물·장면 연결이 없어요');

      insert into verifications (
        review_id, student_id, attempt_no, gap_id, question, answer,
        logic_consistency, specificity, style_consistency, passed, feedback,
        points_awarded, asked_at, answered_at
      ) values (
        v_review,
        v_students[1 + (k % array_length(v_students, 1))],
        1, v_gap,
        '"인상 깊었다"고 했는데, 어느 장면이 그랬어?',
        '주인공이 마지막에 결정을 내리는 장면이요.',
        'pass', (case when k % 3 = 0 then 'weak' else 'pass' end)::score_axis, 'same',
        true, '좋아! 장면을 딱 집어줘서 잘 전해졌어.', 50,
        now() - ((k % 30) || ' days')::interval,
        now() - ((k % 30) || ' days')::interval + interval '41 seconds'
      );
    end loop;
  end loop;
end $$;

-- ── 6. 책갈피 원장 ───────────────────────────────────
-- 합계가 정확히 1,240 이 되게 맞춘다 (docs/spec.md §7).
--   이전 학기 이월  +1390
--   통과 3건 × 50    +150   ← 완독 3권에 해당하는 verification 을 참조
--   ebook 열람권     −300
--   ────────────────────────
--                    1240
--
-- 참고: 통과 9건 중 3건만 원장에 넣는 건 "완독 3권"(CLAUDE.md §10)과 맞추기 위해서다.
-- 실제 서비스에서는 통과할 때마다 트랜잭션 안에서 한 줄씩 쌓인다.
--
-- 1,240 은 50 의 배수가 아니라서(1240 mod 50 = 40) ±50/±300/±450 조합만으로는
-- 만들 수 없다. 이월 금액으로 끝수를 맞춘 이유다.

insert into points_ledger (student_id, delta, reason, ref_id, created_at)
values ('0000a001-0000-4000-8000-000000000001', 1390, 'admin_adjust', null,
        now() - interval '45 days');

insert into points_ledger (student_id, delta, reason, ref_id, created_at)
select v.student_id, 50, 'verification_pass', v.id, v.answered_at
  from verifications v
 where v.student_id = '0000a001-0000-4000-8000-000000000001'
   and v.passed
 order by v.answered_at desc
 limit 3;

insert into points_ledger (student_id, delta, reason, ref_id, created_at)
values ('0000a001-0000-4000-8000-000000000001', -300, 'ebook_pass',
        gen_random_uuid(), now() - interval '5 days');

-- ── 7. 성장 (스트릭 · 도장판) ────────────────────────

insert into streaks (student_id, current_days, longest_days, last_passed_on)
values ('0000a001-0000-4000-8000-000000000001', 7, 12, current_date);

-- 완독 3권당 도장 1개 (docs/spec.md §2)
insert into genre_stamps (student_id, genre, completed_count) values
  ('0000a001-0000-4000-8000-000000000001', '성장',     6),
  ('0000a001-0000-4000-8000-000000000001', '한국소설', 4),
  ('0000a001-0000-4000-8000-000000000001', '고전',     3),
  ('0000a001-0000-4000-8000-000000000001', '외국소설', 2),
  ('0000a001-0000-4000-8000-000000000001', '동화',     1);

-- ── 8. 챌린지 ────────────────────────────────────────

insert into challenges (id, kind, class_id, title, target, starts_on, ends_on)
values
  ('0000e001-0000-4000-8000-000000000001', 'class_goal',
   '0000d001-0000-4000-8000-000000000002',
   '우리 반 100권 읽기', 100,
   current_date - 20, current_date + 10),
  ('0000e001-0000-4000-8000-000000000002', 'season', null,
   '가을 독서 챌린지 🍂', 5,
   current_date - 10, current_date + 20);

insert into challenge_progress (challenge_id, student_id, value)
select '0000e001-0000-4000-8000-000000000001', cm.student_id,
       -- hashtext 는 문서화되지 않은 내부 함수라 쓰지 않는다. uuid 첫 글자로 흩뿌린다.
       1 + (ascii(substr(cm.student_id::text, 1, 1)) % 5)
  from class_members cm
 where cm.class_id = '0000d001-0000-4000-8000-000000000002';

insert into challenge_progress (challenge_id, student_id, value)
values ('0000e001-0000-4000-8000-000000000002',
        '0000a001-0000-4000-8000-000000000001', 3);

-- ── 9. 보호자 링크 ───────────────────────────────────
-- token 은 32자 이상이어야 한다 (0005 의 check 제약).

insert into guardian_links (token, student_id, created_at, revoked_at)
values (encode(sha256('bookit-demo-guardian'::bytea), 'hex'),
        '0000a001-0000-4000-8000-000000000001',
        now() - interval '12 days', null);

commit;

-- ── 확인용 쿼리 ──────────────────────────────────────
-- 시드가 spec.md §7 을 만족하는지 확인한다.
-- psql 메타명령(\echo)은 쓰지 않는다 — psql 이 아닌 클라이언트로 돌리면 파일 전체가 깨진다.

select '책갈피 잔액 (1240 이어야 함)' as check,
       sum(delta)::text as value
  from points_ledger
 where student_id = '0000a001-0000-4000-8000-000000000001'
union all
select '데모 학생 독후감 (12)',
       count(*)::text from reviews
 where student_id = '0000a001-0000-4000-8000-000000000001'
union all
select '데모 학생 통과 (9)',
       count(*)::text from verifications
 where student_id = '0000a001-0000-4000-8000-000000000001' and passed
union all
select '원장의 통과 적립 건수 (3 = 완독 3권)',
       count(*)::text from points_ledger
 where student_id = '0000a001-0000-4000-8000-000000000001'
   and reason = 'verification_pass'
union all
select '스트릭 (7)',
       current_days::text from streaks
 where student_id = '0000a001-0000-4000-8000-000000000001'
union all
select '2반 학생 수 (24)',
       count(*)::text from class_members
 where class_id = '0000d001-0000-4000-8000-000000000002'
union all
select '반 개수 (5)', count(*)::text from classes
union all
select '저작권 만료 도서 (4)', count(*)::text from books where is_public_domain;

-- 반 랭킹 — 2반이 1위여야 한다.
--
-- 랭킹 뷰를 쓰지 않고 기본 테이블에서 직접 집계한다.
-- 뷰 이름이 바뀌어도(v_teacher_class_ranking → v_class_ranking) 이 시드가 깨지지 않게
-- 하려는 것이다. 뷰 자체의 동작 확인은 뷰를 소유한 쪽 테스트가 맡는다.
select
  c.school_name || ' ' || c.grade_level || '학년 ' || c.class_no || '반' as label,
  count(v.id) filter (where v.passed) as verified_count
from classes c
left join class_members cm on cm.class_id = c.id
left join verifications v  on v.student_id = cm.student_id
group by c.id, c.school_name, c.grade_level, c.class_no
order by verified_count desc;
