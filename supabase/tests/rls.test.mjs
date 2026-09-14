// 마이그레이션을 실물 Postgres(PGlite) 에 올려 RLS 와 교사 뷰를 검증한다.
//   npm run test:rls
// 배경: github issue #3, supabase/tests/README.md

import { PGlite } from '@electric-sql/pglite';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const HERE       = dirname(fileURLToPath(import.meta.url));
const MIGRATIONS = join(HERE, '..', 'migrations');
const FIXTURES   = join(HERE, 'fixtures');
const read = p => readFileSync(p, 'utf8');

// seed.sql 과 맞춘 고정 uuid
const T1 = '11111111-1111-1111-1111-111111111111'; // 교사, 반 C1 소유
const T2 = '22222222-2222-2222-2222-222222222222'; // 교사, 반 C2 소유
const S1 = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'; // 학생, C1
const S3 = 'cccccccc-cccc-cccc-cccc-cccccccccccc'; // 학생, C2

const db = await PGlite.create();
const results = [];
const check = (name, ok, detail = '') => results.push({ name, ok, detail });

// ── 적용 ─────────────────────────────────────────────
await db.exec(read(join(FIXTURES, 'shim.sql')));
for (const f of readdirSync(MIGRATIONS).filter(f => f.endsWith('.sql')).sort()) {
  try {
    await db.exec(read(join(MIGRATIONS, f)));
  } catch (e) {
    console.error(`마이그레이션 실패: ${f}\n  ${e.message}`);
    process.exit(1);
  }
}
await db.exec(read(join(FIXTURES, 'grants.sql')));
await db.exec(read(join(FIXTURES, 'seed.sql')));

// 해당 사용자로 로그인한 것처럼 질의한다.
async function as(uid, sql, role = 'authenticated') {
  await db.exec(`select set_config('request.jwt.claim.sub', ${uid ? `'${uid}'` : 'null'}, false);`);
  await db.exec(`set role ${role};`);
  try { return await db.query(sql); } finally { await db.exec('reset role;'); }
}
const names = r => r.rows.map(x => x.name ?? x.label).sort().join(', ');

// ── 뷰 정의 ──────────────────────────────────────────
const opts = await db.query(
  `select coalesce(reloptions, '{}') as reloptions from pg_class where relname = $1`,
  ['v_teacher_student_progress']);
check('v_teacher_student_progress 에 security_barrier=true 가 붙어 있다',
  opts.rows[0]?.reloptions.includes('security_barrier=true'),
  JSON.stringify(opts.rows[0]?.reloptions));

const views = (await db.query(`select relname from pg_class where relkind = 'v'`)).rows.map(r => r.relname);
check('반 랭킹 뷰 이름은 v_class_ranking 이다 (v_teacher_class_ranking 아님)',
  views.includes('v_class_ranking') && !views.includes('v_teacher_class_ranking'),
  views.join(', '));

// ── 교사 진도 뷰: 자기 반만 ──────────────────────────
const p1 = await as(T1, 'select * from v_teacher_student_progress');
check('T1 진도뷰 → 자기 반 학생만', names(p1) === '학생S1, 학생S2', names(p1) || '(0행)');
check('T1 진도뷰 → 교사 본인은 안 나온다', !names(p1).includes('선생'), names(p1));

const p2 = await as(T2, 'select * from v_teacher_student_progress');
check('T2 진도뷰 → 자기 반 학생만', names(p2) === '학생S3', names(p2) || '(0행)');

const ps = await as(S1, 'select * from v_teacher_student_progress');
check('학생이 진도뷰를 보면 0행', ps.rows.length === 0, `${ps.rows.length}행`);

// definer 뷰라 verifications 의 RLS 를 우회해 집계가 실제로 채워진다.
// invoker 로 바꾸면 이 조인이 통째로 잘려 0 이 된다 — 이 검사가 그걸 잡는다.
const agg = p1.rows.find(r => r.name === '학생S1');
check('진도뷰 집계가 채워진다 (passed_count=1, avg_score=100)',
  Number(agg?.passed_count) === 1 && Number(agg?.avg_score) === 100,
  `passed_count=${agg?.passed_count} avg_score=${agg?.avg_score}`);

// ── 반 랭킹 뷰: 전체 반 ──────────────────────────────
check('교사의 반 랭킹 → 전체 반', (await as(T1, 'select * from v_class_ranking')).rows.length === 2);
check('학생의 반 랭킹 → 전체 반 (남의 반 포함)', (await as(S1, 'select * from v_class_ranking')).rows.length === 2);

// ── CLAUDE.md §5 ─────────────────────────────────────
for (const [what, sql] of [
  ['verifications.answer', 'select answer from verifications'],
  ['reviews.body',         'select body from reviews'],
  ['review_gaps.quote',    'select quote from review_gaps'],
]) {
  const r = await as(T1, sql);
  check(`§5 교사가 ${what} 를 직접 조회하면 0행`, r.rows.length === 0, `${r.rows.length}행`);
}

// 유일한 예외: 학생이 직접 켠 공개
await as(S1, `update reviews set is_shared = true where student_id = '${S1}'`);
check('학생이 공개한 독후감은 담당 교사에게 열린다',
  (await as(T1, 'select body from reviews')).rows.length === 1);
check('남의 반 교사는 공개된 독후감도 못 본다',
  (await as(T2, 'select body from reviews')).rows.length === 0);

// ── 학생 본인 데이터 ─────────────────────────────────
const own = await as(S1, 'select answer from verifications');
check('학생 본인 답변은 본인에게만 보인다',
  own.rows.length === 1 && own.rows[0].answer.includes('S1'), `${own.rows.length}행`);
check('학생이 남의 답변을 조회하면 0행',
  (await as(S1, `select answer from verifications where student_id = '${S3}'`)).rows.length === 0);

// ── anon ─────────────────────────────────────────────
let anonOk;
try { anonOk = (await as(null, 'select * from v_teacher_student_progress', 'anon')).rows.length === 0; }
catch { anonOk = true; } // 권한 오류도 차단이다
check('anon 은 진도뷰에 접근할 수 없다', anonOk);

// ── security_barrier 가 실제로 막고 있는가 ────────────
//
// definer 뷰의 접근 통제는 where is_teacher_of() 하나뿐이다.
// barrier 가 없으면 사용자가 넘긴 함수가 그 필터보다 먼저 평가되도록
// base scan 까지 밀려 내려가, 남의 반 행이 함수 인자로 샌다.
// name 이 그룹핑 컬럼이라 group by 는 이걸 막아주지 못한다.
await db.exec(`
  create function leak(t text) returns boolean language plpgsql stable cost 1 as $leak$
  begin
    perform set_config('test.leaked', coalesce(current_setting('test.leaked', true), '') || t || ' ', false);
    return true;
  end $leak$;

  -- 실제 뷰와 동일하되 barrier 만 뺀 대조군
  create view v_agg_nobarrier with (security_invoker = false) as
  select p.id as student_id, p.display_name as name,
         count(*) filter (where v.passed) as passed_count
  from profiles p left join verifications v on v.student_id = p.id
  where is_teacher_of(p.id) group by p.id, p.display_name;
  grant select on v_agg_nobarrier to authenticated;
`);

async function leaked(view) {
  await db.exec(`select set_config('test.leaked', '', false);`);
  await as(T1, `select * from ${view} where leak(name)`);
  const raw = (await db.query(`select current_setting('test.leaked', true) as v`)).rows[0].v || '';
  return raw.trim().split(/\s+/).filter(Boolean).sort();
}
const withBarrier = await leaked('v_teacher_student_progress');
const noBarrier   = await leaked('v_agg_nobarrier');

check('barrier 있음 → 사용자 함수가 자기 반 학생만 본다',
  withBarrier.join(' ') === '학생S1 학생S2', withBarrier.join(' '));
check('barrier 없는 대조군은 실제로 샌다 (이 검사가 실패하면 위 검사는 무의미)',
  noBarrier.length > withBarrier.length, `대조군이 본 것: ${noBarrier.join(' ')}`);

// ── 진도뷰 class_id · streak (0007) ──────────────────
// streaks 는 학생 본인만 읽는다 (0004). 교사에게는 뷰로만 나가야 한다.

const progressCols = (await db.query(
  `select column_name from information_schema.columns where table_name = 'v_teacher_student_progress'`
)).rows.map(r => r.column_name);

check('진도뷰에 class_id 와 streak 이 있다',
  progressCols.includes('class_id') && progressCols.includes('streak'),
  progressCols.join(', '));

check('§5 진도뷰에 자유 서술 컬럼이 없다',
  !progressCols.some(c => ['body', 'answer', 'quote', 'reason', 'feedback', 'question'].includes(c)),
  progressCols.join(', '));

await db.exec(`insert into streaks (student_id, current_days, longest_days, last_passed_on)
               values ('${S1}', 7, 9, current_date)
               on conflict (student_id) do update set current_days = 7;`);

const prog = await as(T1, 'select name, streak, class_id from v_teacher_student_progress');
const s1row = prog.rows.find(r => r.name === '학생S1');
const s2row = prog.rows.find(r => r.name === '학생S2');

check('교사 진도뷰에 streak 이 실린다', Number(s1row?.streak) === 7, `streak=${s1row?.streak}`);
check('streaks 행이 없는 학생의 streak 은 0 (null 아님)',
  Number(s2row?.streak) === 0 && s2row?.streak !== null, `streak=${s2row?.streak}`);
check('진도뷰 행마다 class_id 가 붙는다',
  prog.rows.length > 0 && prog.rows.every(r => r.class_id), JSON.stringify(prog.rows.map(r => r.class_id)));
check('streak 이 붙어도 학생은 여전히 진도뷰를 못 본다',
  (await as(S1, 'select * from v_teacher_student_progress')).rows.length === 0);
check('학생은 남의 streaks 행을 직접 못 읽는다',
  (await as(S1, `select * from streaks where student_id <> '${S1}'`)).rows.length === 0);

// ── join_code 알파벳 (0006) ──────────────────────────
// 헷갈리는 0/O/1/I 는 코드에 쓰지 않는다. 함수 안에만 있던 규칙을 테이블 제약으로 못박았다.

async function insertCode(code) {
  try {
    await db.exec(`insert into classes (teacher_id, school_name, grade_level, class_no, join_code)
                   values ('${T1}', '한빛초', 5, 9, '${code}');`);
    await db.exec(`delete from classes where join_code = '${code}';`);
    return true;
  } catch {
    return false;
  }
}

check('허용 알파벳 코드는 들어간다', await insertCode('HBCLSB'));
check('0 이 든 코드는 거부된다 (예전 시드의 HB5002)', !(await insertCode('HB5002')));
check('O·I 가 든 코드는 거부된다', !(await insertCode('HBCLSO')));
check('generate_join_code() 결과는 알파벳 규칙을 지킨다',
  /^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$/.test(
    (await db.query('select generate_join_code() as code')).rows[0].code));

// ── record_verification_result (0008) ────────────────
// 채점 결과 + 책갈피 적립 + 독후감 상태를 한 트랜잭션으로 남기는 함수.
// 여기서 지키려는 것은 두 가지다: 학생이 직접 부를 수 없어야 하고, 같은 시도로
// 두 번 적립되지 않아야 한다 (docs/spec.md §4).

const V_OPEN = 'f0000000-0000-0000-0000-00000000000b'; // S1 의 채점 전 시도
const V_S3   = 'f0000000-0000-0000-0000-00000000000c'; // S3 의 채점 전 시도

await db.exec(`
  insert into reviews (id, student_id, book_id, body, status) values
    ('d0000000-0000-0000-0000-00000000000b','${S1}','b0000000-0000-0000-0000-000000000001','S1 의 두 번째 독후감','questioning'),
    ('d0000000-0000-0000-0000-00000000000d','${S3}','b0000000-0000-0000-0000-000000000001','S3 의 두 번째 독후감','questioning');
  insert into review_gaps (id, review_id, ord, quote, gap_type, reason) values
    ('e0000000-0000-0000-0000-00000000000b','d0000000-0000-0000-0000-00000000000b',1,'재미있었다','feeling_only','감상만 남음'),
    ('e0000000-0000-0000-0000-00000000000d','d0000000-0000-0000-0000-00000000000d',1,'재미있었다','feeling_only','감상만 남음');
  insert into verifications (id, review_id, student_id, attempt_no, gap_id, question) values
    ('${V_OPEN}','d0000000-0000-0000-0000-00000000000b','${S1}',1,'e0000000-0000-0000-0000-00000000000b','왜 그렇게 생각했어?'),
    ('${V_S3}','d0000000-0000-0000-0000-00000000000d','${S3}',1,'e0000000-0000-0000-0000-00000000000d','왜 그렇게 생각했어?');
`);

const record = (uid, vid, student, passed, role = 'service_role') => as(
  uid,
  `select points_awarded from record_verification_result(
     '${vid}'::uuid, '${student}'::uuid, '답변 원문',
     'pass'::score_axis, 'pass'::score_axis, 'same'::style_axis,
     ${passed}, '잘했어!', 50)`,
  role,
);

// 학생 역할로 직접 부를 수 있으면 자기 시도를 스스로 통과시키고 책갈피까지 정할 수 있다.
let studentCallBlocked = false;
try {
  await record(S1, V_OPEN, S1, true, 'authenticated');
} catch {
  studentCallBlocked = true;
}
check('학생(authenticated) 은 record_verification_result 를 실행할 수 없다', studentCallBlocked);

const awarded = await record(null, V_OPEN, S1, true);
check('통과 채점이 points_awarded 를 돌려준다', Number(awarded.rows[0]?.points_awarded) === 50,
  `points_awarded=${awarded.rows[0]?.points_awarded}`);

const ledger = await db.query(
  `select delta, reason from points_ledger where ref_id = $1`, [V_OPEN]);
check('통과하면 원장에 +50 이 한 줄 남는다',
  ledger.rows.length === 1 && Number(ledger.rows[0].delta) === 50
    && ledger.rows[0].reason === 'verification_pass',
  JSON.stringify(ledger.rows));

const passedReview = await db.query(
  `select status from reviews where id = 'd0000000-0000-0000-0000-00000000000b'`);
check('통과하면 독후감 상태가 passed 로 바뀐다',
  passedReview.rows[0]?.status === 'passed', passedReview.rows[0]?.status);

// 버튼 두 번 누르기. answered_at 이 이미 차 있으므로 두 번째는 P0002 로 막힌다.
let secondCall = null;
try {
  await record(null, V_OPEN, S1, true);
} catch (e) {
  secondCall = e.code ?? e.message;
}
// P0002 는 modules/verification 의 answer.ts 가 "이미 채점했어" 로 바꿔 주는 코드다.
// 여기서 코드가 바뀌면 화면에 "잠깐 문제가 생겼어" 가 뜬다.
check('같은 시도를 두 번 채점하면 P0002 로 막힌다 (이중 적립 방지)',
  secondCall === 'P0002', String(secondCall));
check('두 번 시도해도 원장은 한 줄뿐이다',
  (await db.query(`select 1 from points_ledger where ref_id = $1`, [V_OPEN])).rows.length === 1);

// p_student_id 가 다르면 함수 안의 소유권 조건에서 걸린다.
let otherStudentBlocked = false;
try {
  await record(null, V_S3, S1, true);
} catch {
  otherStudentBlocked = true;
}
check('남의 시도는 채점되지 않는다 (p_student_id 불일치)', otherStudentBlocked);

// 실패는 verifications 행만 남기고 원장에는 아무것도 쓰지 않는다 (CLAUDE.md §4).
await record(null, V_S3, S3, false);
check('실패 채점은 원장에 행을 남기지 않는다',
  (await db.query(`select 1 from points_ledger where ref_id = $1`, [V_S3])).rows.length === 0);
check('실패 채점은 points_awarded 가 0 이다',
  Number((await db.query(`select points_awarded from verifications where id = $1`, [V_S3]))
    .rows[0]?.points_awarded) === 0);
check('실패하면 독후감 상태가 failed 로 바뀐다',
  (await db.query(`select status from reviews where id = 'd0000000-0000-0000-0000-00000000000d'`))
    .rows[0]?.status === 'failed');

// ── bump_growth_on_pass (0011) ────────────────────────
// 통과(verification_pass) 시 스트릭·장르 도장을 올리는 트리거.
// 리뷰 반영: 스트릭은 하루 1회(KST 기준)만 올리고 — current_days 는 "연속 일수"라는
// 뜻을 teacher 뷰·seed 와 공유해야 한다 — 책의 장르 태그 전부에는 매번 도장 진행도를 올린다.

// KST 변환 자체를 wall-clock 에 기대지 않고 확인한다.
// UTC 2026-01-01 16:00 은 KST 로 2026-01-02 01:00 — current_date(UTC) 라면 여전히
// 1일이지만, KST 기준으로는 이미 2일로 넘어가 있어야 한다.
const kst = await db.query(
  `select (timestamptz '2026-01-01 16:00:00+00' at time zone 'Asia/Seoul')::date = date '2026-01-02' as ok`);
check('KST 변환이 UTC 자정 경계에서 날짜를 하루 앞당긴다',
  kst.rows[0]?.ok === true, JSON.stringify(kst.rows[0]));

// "0007" 구간의 시드는 last_passed_on 을 UTC current_date 로 넣었다. 트리거는 KST 로
// "오늘"을 판단하므로, UTC 저녁(KST 새벽) 시간대에 테스트를 돌리면 이 값이 실제로는
// "어제"가 돼 버려 다음 통과가 캡이 아니라 증가로 갈 수 있다 — 그 시간대 의존성을
// 없애려고 트리거와 같은 식으로 "오늘"을 다시 맞춰 둔다.
await db.exec(`
  update streaks set last_passed_on = (now() at time zone 'Asia/Seoul')::date
  where student_id = '${S1}'`);

// S1 의 streaks 는 위 "0007" 구간에서 이미 (current=7, longest=9, last_passed_on=오늘)
// 로 시드돼 있고, 그 뒤 V_OPEN 통과가 트리거를 한 번 거쳤다 — 오늘 이미 센 것으로 보고
// 그대로여야 한다(하루 1회 캡).
const afterFirstPass = await db.query(
  `select current_days, longest_days, last_passed_on from streaks where student_id = $1`, [S1]);
check('오늘 이미 스트릭이 찍혀 있으면 통과해도 그대로다 (하루 1회 캡)',
  Number(afterFirstPass.rows[0]?.current_days) === 7
    && Number(afterFirstPass.rows[0]?.longest_days) === 9,
  JSON.stringify(afterFirstPass.rows[0]));

await db.exec(`
  insert into books (id, title, author, tags) values
    ('b1111111-0000-0000-0000-000000000002','책나무 테스트북 A','작가A','{성장,한국소설}'),
    ('b1111111-0000-0000-0000-000000000003','책나무 테스트북 B','작가B','{한국소설,고전}'),
    ('b1111111-0000-0000-0000-000000000004','책나무 테스트북 C','작가C','{성장}');

  insert into reviews (id, student_id, book_id, body, status) values
    ('d1111111-0000-0000-0000-000000000002','${S1}','b1111111-0000-0000-0000-000000000002','두 번째 완독','questioning'),
    ('d1111111-0000-0000-0000-000000000003','${S1}','b1111111-0000-0000-0000-000000000003','세 번째 완독','questioning'),
    ('d1111111-0000-0000-0000-000000000004','${S1}','b1111111-0000-0000-0000-000000000004','네 번째 완독','questioning');
  insert into review_gaps (id, review_id, ord, quote, gap_type, reason) values
    ('e1111111-0000-0000-0000-000000000002','d1111111-0000-0000-0000-000000000002',1,'좋았다','feeling_only','감상만 남음'),
    ('e1111111-0000-0000-0000-000000000003','d1111111-0000-0000-0000-000000000003',1,'좋았다','feeling_only','감상만 남음'),
    ('e1111111-0000-0000-0000-000000000004','d1111111-0000-0000-0000-000000000004',1,'좋았다','feeling_only','감상만 남음');
  insert into verifications (id, review_id, student_id, attempt_no, gap_id, question) values
    ('f1111111-0000-0000-0000-000000000002','d1111111-0000-0000-0000-000000000002','${S1}',1,'e1111111-0000-0000-0000-000000000002','왜 그렇게 생각했어?'),
    ('f1111111-0000-0000-0000-000000000003','d1111111-0000-0000-0000-000000000003','${S1}',1,'e1111111-0000-0000-0000-000000000003','왜 그렇게 생각했어?'),
    ('f1111111-0000-0000-0000-000000000004','d1111111-0000-0000-0000-000000000004','${S1}',1,'e1111111-0000-0000-0000-000000000004','왜 그렇게 생각했어?');
`);

// 같은 날 두 번째 통과 — 하루 1회 캡이라 스트릭은 그대로다.
await record(null, 'f1111111-0000-0000-0000-000000000002', S1, true);
const afterSecondPass = await db.query(
  `select current_days, longest_days from streaks where student_id = $1`, [S1]);
check('같은 날 두 번째 통과는 스트릭을 늘리지 않는다 (하루 1회 캡)',
  Number(afterSecondPass.rows[0]?.current_days) === 7
    && Number(afterSecondPass.rows[0]?.longest_days) === 9,
  JSON.stringify(afterSecondPass.rows[0]));

const stampsAfterSecond = await db.query(
  `select genre, completed_count from genre_stamps where student_id = $1 order by genre`, [S1]);
check('장르 태그 두 개짜리 책을 완독하면 태그 전부에 도장 진행도가 붙는다',
  stampsAfterSecond.rows.length === 2
    && stampsAfterSecond.rows.every((r) => Number(r.completed_count) === 1),
  JSON.stringify(stampsAfterSecond.rows));

// 세 번째 통과 — 겹치는 태그(한국소설)는 누적되고, 새 태그(고전)는 새로 생긴다.
await record(null, 'f1111111-0000-0000-0000-000000000003', S1, true);
const stampsAfterThird = await db.query(
  `select genre, completed_count from genre_stamps where student_id = $1 order by genre`, [S1]);
const byGenre = Object.fromEntries(stampsAfterThird.rows.map((r) => [r.genre, Number(r.completed_count)]));
check('겹치는 장르 태그는 누적되고 새 태그는 새로 생긴다',
  byGenre['성장'] === 1 && byGenre['한국소설'] === 2 && byGenre['고전'] === 1,
  JSON.stringify(byGenre));

// 스트릭이 끊긴 경우 — last_passed_on 을 열흘 전으로 되돌린 뒤 다시 통과하면 1로 리셋된다.
await db.exec(
  `update streaks set last_passed_on = current_date - 10 where student_id = '${S1}'`);
await record(null, 'f1111111-0000-0000-0000-000000000004', S1, true);
const afterGap = await db.query(
  `select current_days, longest_days from streaks where student_id = $1`, [S1]);
check('마지막 통과일이 열흘 전이면 스트릭이 1로 리셋된다',
  Number(afterGap.rows[0]?.current_days) === 1, JSON.stringify(afterGap.rows[0]));
check('리셋되어도 longest_days 는 이전 최고치를 유지한다',
  Number(afterGap.rows[0]?.longest_days) === 9, JSON.stringify(afterGap.rows[0]));

// 실패한 시도는 트리거를 건드리지 않는다 — reason 이 애초에 verification_pass 가 아니다.
const streakBeforeFail = (await db.query(
  `select current_days from streaks where student_id = $1`, [S3])).rows[0]?.current_days ?? null;
check('실패 채점은 스트릭에 영향을 주지 않는다 (앞서 이미 실패로 기록된 S3 그대로)',
  streakBeforeFail === null, `current_days=${streakBeforeFail}`);

// ── 출력 ─────────────────────────────────────────────
const failed = results.filter(r => !r.ok);
for (const r of results) {
  console.log(`${r.ok ? 'ok  ' : 'FAIL'}  ${r.name}`);
  if (!r.ok) console.log(`        받은 값: ${r.detail}`);
}
console.log(`\n${results.length - failed.length}/${results.length} 통과`);
process.exit(failed.length ? 1 : 0);
