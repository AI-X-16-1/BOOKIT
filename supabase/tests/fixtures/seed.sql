-- 교사 2명, 반 2개, 학생 3명 (S1,S2 -> C1 / S3 -> C2)
insert into auth.users (id) values
  ('11111111-1111-1111-1111-111111111111'), -- T1
  ('22222222-2222-2222-2222-222222222222'), -- T2
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'), -- S1
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'), -- S2
  ('cccccccc-cccc-cccc-cccc-cccccccccccc'); -- S3

insert into profiles (id, role, display_name, grade_level) values
  ('11111111-1111-1111-1111-111111111111','teacher','T1선생', null),
  ('22222222-2222-2222-2222-222222222222','teacher','T2선생', null),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','student','학생S1', 5),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb','student','학생S2', 5),
  ('cccccccc-cccc-cccc-cccc-cccccccccccc','student','학생S3', 6);

insert into classes (id, teacher_id, school_name, grade_level, class_no, join_code) values
  ('c1c1c1c1-0000-0000-0000-000000000001','11111111-1111-1111-1111-111111111111','한빛초',5,2,'ABC234'),
  ('c2c2c2c2-0000-0000-0000-000000000002','22222222-2222-2222-2222-222222222222','달빛초',6,1,'XYZ789');

insert into class_members (class_id, student_id) values
  ('c1c1c1c1-0000-0000-0000-000000000001','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'),
  ('c1c1c1c1-0000-0000-0000-000000000001','bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'),
  ('c2c2c2c2-0000-0000-0000-000000000002','cccccccc-cccc-cccc-cccc-cccccccccccc');

insert into books (id, title, author) values
  ('b0000000-0000-0000-0000-000000000001','나의 라임오렌지나무','바스콘셀로스');

insert into reviews (id, student_id, book_id, body, status) values
  ('d0000000-0000-0000-0000-00000000000a','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','b0000000-0000-0000-0000-000000000001','S1 의 비밀 독후감 본문','passed'),
  ('d0000000-0000-0000-0000-00000000000c','cccccccc-cccc-cccc-cccc-cccccccccccc','b0000000-0000-0000-0000-000000000001','S3 의 비밀 독후감 본문','passed');

insert into review_gaps (id, review_id, ord, quote, gap_type, reason) values
  ('e0000000-0000-0000-0000-00000000000a','d0000000-0000-0000-0000-00000000000a',1,'그냥 슬펐다','feeling_only','감상만 남음'),
  ('e0000000-0000-0000-0000-00000000000c','d0000000-0000-0000-0000-00000000000c',1,'좋았다','feeling_only','감상만 남음');

insert into verifications
  (review_id, student_id, attempt_no, gap_id, question, answer,
   logic_consistency, specificity, style_consistency, passed, points_awarded, answered_at) values
  ('d0000000-0000-0000-0000-00000000000a','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',1,'e0000000-0000-0000-0000-00000000000a','왜 그렇게 생각했어?','S1 의 비밀 답변 원문','pass','pass','same',true,50,now()),
  ('d0000000-0000-0000-0000-00000000000c','cccccccc-cccc-cccc-cccc-cccccccccccc',1,'e0000000-0000-0000-0000-00000000000c','왜 그렇게 생각했어?','S3 의 비밀 답변 원문','pass','weak','same',true,50,now());
