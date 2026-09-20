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
const S2 = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'; // 학생, C1
const S3 = 'cccccccc-cccc-cccc-cccc-cccccccccccc'; // 학생, C2

const db = await PGlite.create();
const results = [];
const check = (name, ok, detail = '') => results.push({ name, ok, detail });

// ── 적용 ─────────────────────────────────────────────
await db.exec(read(join(FIXTURES, 'shim.sql')));
await db.exec(read(join(FIXTURES, 'grants.sql'))); // 마이그레이션 전 — default privileges
for (const f of readdirSync(MIGRATIONS).filter(f => f.endsWith('.sql')).sort()) {
  try {
    await db.exec(read(join(MIGRATIONS, f)));
  } catch (e) {
    console.error(`마이그레이션 실패: ${f}\n  ${e.message}`);
    process.exit(1);
  }
}
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

// ── issue #22: 학생은 verifications 에 쓸 수 없다 ────────
// for all 정책이었을 때는 passed=true 행을 직접 넣어 반 랭킹을 올릴 수 있었다.
async function denied(uid, sql) {
  try { await as(uid, sql); return false; }
  catch (e) { return /row-level security|permission denied/.test(e.message); }
}
const R1 = 'd0000000-0000-0000-0000-00000000000a'; // S1 의 독후감
const G1 = 'e0000000-0000-0000-0000-00000000000a'; // 그 독후감의 gap

const before = Number((await as(T1, `select * from v_class_ranking where label like '%한빛초%'`)).rows[0].verified_count);
check('#22 학생이 verifications 에 통과 행을 insert 하면 거부',
  await denied(S1, `insert into verifications (review_id, student_id, attempt_no, gap_id, question, passed, answered_at)
                    values ('${R1}', '${S1}', 99, '${G1}', 'forged', true, now())`));
// 정책이 없는 update/delete 는 에러가 아니라 0행으로 조용히 막힌다.
const upd = await as(S1, `update verifications set asked_at = now() + interval '1 hour' where student_id = '${S1}'`);
check('#22 학생이 자기 verifications 를 update 하면 0행 (asked_at 조작)', upd.affectedRows === 0, `${upd.affectedRows}행`);
const del = await as(S1, `delete from verifications where student_id = '${S1}'`);
check('#22 학생이 자기 verifications 를 delete 하면 0행', del.affectedRows === 0, `${del.affectedRows}행`);
const after = Number((await as(T1, `select * from v_class_ranking where label like '%한빛초%'`)).rows[0].verified_count);
check('#22 반 랭킹 verified_count 가 그대로다', before === after, `${before} → ${after}`);
check('학생 본인 verifications 는 여전히 읽힌다',
  (await as(S1, 'select id from verifications')).rows.length === 1);

// reviews.status 는 컬럼 단위로 잠겨 있다. body 와 is_shared 는 계속 쓴다.
check('#22 학생이 reviews.status 를 바꾸면 거부',
  await denied(S1, `update reviews set status = 'passed' where student_id = '${S1}'`));
check('#22 학생이 status 를 지정해 reviews 를 insert 하면 거부',
  await denied(S1, `insert into reviews (student_id, book_id, status) values ('${S2}', 'b0000000-0000-0000-0000-000000000001', 'passed')`));
check('학생은 reviews.body 를 여전히 쓴다',
  !(await denied(S1, `update reviews set body = '고쳐 씀', char_count = 4, updated_at = now() where student_id = '${S1}'`)));
check('학생은 초고를 여전히 만든다 (student_id, book_id 만)',
  !(await denied(S2, `insert into reviews (student_id, book_id) values ('${S2}', 'b0000000-0000-0000-0000-000000000001')`)));

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

// last_passed_on 은 트리거(0011)와 같은 식으로 KST "오늘"을 넣는다. UTC current_date 를
// 넣으면 KST 00~09시(UTC 전날 15~24시)에 돌릴 때 "어제"가 돼, 뒤의 V_OPEN 통과가
// 하루 1회 캡이 아니라 증가(7→8)로 가서 스트릭 테스트가 그 시간대에만 깨졌다 (#181).
await db.exec(`insert into streaks (student_id, current_days, longest_days, last_passed_on)
               values ('${S1}', 7, 9, (now() at time zone 'Asia/Seoul')::date)
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

// ── exchange_points (0010) ────────────────────────────
// 책갈피 교환의 잔액 확인 + 차감을 한 트랜잭션으로 남기는 함수.
// 여기서 지키려는 것: 학생이 직접 부를 수 없어야 하고, 잔액을 넘는 교환은 막혀야 한다
// (docs/spec.md §4, §5).

const exchangeCall = (uid, student, reason, cost, role = 'service_role') => as(
  uid,
  `select delta, reason, ref_id from exchange_points(
     '${student}'::uuid, '${reason}'::point_reason, ${cost})`,
  role,
);

// S1 은 위 record_verification_result 테스트에서 이미 +50 을 받아 잔액이 50이다.
let studentExchangeBlocked = false;
try {
  await exchangeCall(S1, S1, 'ebook_pass', 300, 'authenticated');
} catch {
  studentExchangeBlocked = true;
}
check('학생(authenticated) 은 exchange_points 를 실행할 수 없다', studentExchangeBlocked);

// 잔액(50)보다 비싼 교환(300)은 check_violation(23514)으로 막힌다.
let insufficient = null;
try {
  await exchangeCall(null, S1, 'ebook_pass', 300);
} catch (e) {
  insufficient = e.code ?? e.message;
}
check('잔액보다 비싼 교환은 23514 로 막힌다 (책갈피 부족)',
  insufficient === '23514', String(insufficient));
check('잔액 부족으로 막힌 교환은 원장에 행을 남기지 않는다',
  (await db.query(
    `select 1 from points_ledger where student_id = $1 and reason = 'ebook_pass'`, [S1]))
    .rows.length === 0);

// S3 에게 admin_adjust 로 잔액을 만들어 실제 차감 경로를 검증한다.
await db.exec(
  `insert into points_ledger (student_id, delta, reason) values ('${S3}', 500, 'admin_adjust')`);

const exchanged = await exchangeCall(null, S3, 'audiobook_pass', 450);
check('교환이 성공하면 원장에 −450 행이 남는다',
  Number(exchanged.rows[0]?.delta) === -450 && exchanged.rows[0]?.reason === 'audiobook_pass',
  JSON.stringify(exchanged.rows[0]));

const s3Balance = await db.query(
  `select coalesce(sum(delta), 0) as balance from points_ledger where student_id = $1`, [S3]);
check('교환 뒤 S3 잔액이 50으로 줄어든다', Number(s3Balance.rows[0]?.balance) === 50,
  s3Balance.rows[0]?.balance);

// 남은 잔액(50)으로 또 오디오북(450)을 교환하면 다시 막힌다 — 두 번째 호출도 잔액을 다시 확인한다.
let secondExchangeBlocked = false;
try {
  await exchangeCall(null, S3, 'audiobook_pass', 450);
} catch (e) {
  secondExchangeBlocked = (e.code ?? e.message) === '23514';
}
check('줄어든 잔액으로 또 교환하면 다시 23514 로 막힌다', secondExchangeBlocked);

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

// ── 0014 게임화: RLS 와 진화 트리거 ──────────────────────
// 서재 책 하나(장 2개)에 캐릭터를 붙인다. 시드가 하는 일과 같다.
await db.exec(`
  insert into books (id, title, author, tags, is_public_domain) values
    ('b2222222-0000-0000-0000-000000000001','알 테스트북','작가Z','{동화}', true);
  insert into book_contents (book_id, chapter_no, title, body) values
    ('b2222222-0000-0000-0000-000000000001', 1, '1장', '본문 하나'),
    ('b2222222-0000-0000-0000-000000000001', 2, '2장', '본문 둘');
  insert into characters (book_id, name, stage_names) values
    ('b2222222-0000-0000-0000-000000000001', '알 테스트 요정', '{알,아기 요정,요정}');
`);
const GB = 'b2222222-0000-0000-0000-000000000001';

check('카탈로그(characters)는 학생 누구나 읽는다',
  (await as(S3, `select name from characters where book_id = '${GB}'`)).rows.length === 1);

// 학생은 자기 읽기 기록만 넣는다
check('학생은 자기 reading_progress 를 넣는다',
  !(await denied(S1, `insert into reading_progress (student_id, book_id, chapter_no) values ('${S1}', '${GB}', 1)`)));
check('학생은 남의 reading_progress 를 못 넣는다',
  await denied(S1, `insert into reading_progress (student_id, book_id, chapter_no) values ('${S3}', '${GB}', 1)`));

// 첫 장을 읽으면 알(stage 0)이 생긴다 — 트리거가 만든다
const egg = await db.query(
  `select stage from student_characters where student_id = $1 and book_id = $2`, [S1, GB]);
check('첫 장을 읽으면 알(stage 0)이 생긴다', Number(egg.rows[0]?.stage) === 0, JSON.stringify(egg.rows[0]));
check('학생은 자기 캐릭터를 읽는다',
  (await as(S1, `select stage from student_characters`)).rows.length === 1);
check('학생은 남의 캐릭터를 못 본다',
  (await as(S3, `select stage from student_characters`)).rows.length === 0);
check('학생은 자기 캐릭터 stage 를 직접 못 올린다 (update 정책 없음)',
  (await as(S1, `update student_characters set stage = 2 where student_id = '${S1}' returning stage`)).rows.length === 0);
check('교사는 학생 캐릭터를 못 본다 (게임 기록은 성적이 아니다)',
  (await as(T1, `select stage from student_characters`)).rows.length === 0);

// 마지막 장까지 읽으면 부화(stage 1)
await as(S1, `insert into reading_progress (student_id, book_id, chapter_no) values ('${S1}', '${GB}', 2)`);
const hatched = await db.query(
  `select stage from student_characters where student_id = $1 and book_id = $2`, [S1, GB]);
check('마지막 장까지 읽으면 부화(stage 1)', Number(hatched.rows[0]?.stage) === 1, JSON.stringify(hatched.rows[0]));

// 체크포인트: 학생은 못 쓰고 읽기만. 통과가 찍히면 부화 (이미 1이면 그대로)
check('학생은 checkpoints 를 직접 못 만든다',
  await denied(S1, `insert into checkpoints (student_id, book_id, chapter_no, question) values ('${S1}', '${GB}', 1, 'q')`));
await db.exec(`insert into checkpoints (id, student_id, book_id, chapter_no, question) values
  ('c2222222-0000-0000-0000-000000000001', '${S3}', '${GB}', 1, '왜 그렇게 생각했어?')`);
await db.exec(`update checkpoints set answer = '이래서', answered_at = now(), passed = true
  where id = 'c2222222-0000-0000-0000-000000000001'`);
const s3char = await db.query(
  `select stage from student_characters where student_id = $1 and book_id = $2`, [S3, GB]);
check('체크포인트를 통과하면 알 없이도 바로 부화(stage 1)', Number(s3char.rows[0]?.stage) === 1, JSON.stringify(s3char.rows[0]));
check('학생은 자기 체크포인트를 읽는다',
  (await as(S3, `select question from checkpoints`)).rows.length === 1);
check('학생은 남의 체크포인트를 못 본다',
  (await as(S1, `select question from checkpoints`)).rows.length === 0);

// 검증 통과(책갈피 적립)하면 최종 진화(stage 2). 0011 트리거 옆에 하나 더 걸린 것이라 책갈피는 그대로다.
await db.exec(`
  insert into reviews (id, student_id, book_id, body, status) values
    ('d2222222-0000-0000-0000-000000000001','${S1}','${GB}','완독','questioning');
  insert into review_gaps (id, review_id, ord, quote, gap_type, reason) values
    ('e2222222-0000-0000-0000-000000000001','d2222222-0000-0000-0000-000000000001',1,'좋았다','feeling_only','감상만 남음');
  insert into verifications (id, review_id, student_id, attempt_no, gap_id, question) values
    ('f2222222-0000-0000-0000-000000000001','d2222222-0000-0000-0000-000000000001','${S1}',1,'e2222222-0000-0000-0000-000000000001','왜?');
`);
const balanceBefore = Number((await db.query(`select coalesce(sum(delta),0) as s from points_ledger where student_id = $1`, [S1])).rows[0].s);
await record(null, 'f2222222-0000-0000-0000-000000000001', S1, true);
const finalStage = await db.query(
  `select stage, evolved_at from student_characters where student_id = $1 and book_id = $2`, [S1, GB]);
check('검증을 통과하면 최종 진화(stage 2)', Number(finalStage.rows[0]?.stage) === 2, JSON.stringify(finalStage.rows[0]));
const balanceAfter = Number((await db.query(`select coalesce(sum(delta),0) as s from points_ledger where student_id = $1`, [S1])).rows[0].s);
check('진화 트리거가 붙어도 책갈피는 그대로 +50', balanceAfter - balanceBefore === 50, `${balanceBefore} → ${balanceAfter}`);

// 캐릭터 없는 책(검색 유입분)은 통과해도 student_characters 에 아무것도 생기지 않는다
const noChar = await db.query(
  `select count(*)::int as n from student_characters where student_id = $1 and book_id = 'b1111111-0000-0000-0000-000000000004'`, [S1]);
check('캐릭터 없는 책은 통과해도 캐릭터 행이 생기지 않는다', noChar.rows[0].n === 0, `${noChar.rows[0].n}행`);

// 탐험가 등급: 본인 profiles 갱신, 값 제약
check('학생은 자기 탐험가 등급을 고른다',
  !(await denied(S1, `update profiles set explorer_rank = '탐험가' where id = '${S1}'`)));
let badRank = false;
try { await db.exec(`update profiles set explorer_rank = '왕' where id = '${S1}'`); } catch (e) { badRank = /check constraint|violates/.test(e.message); }
check('탐험가 등급은 정해진 셋 중 하나만', badRank);

// ── 0015: curated 책은 캐릭터가 자동으로 생긴다 ────────────
await db.exec(`insert into books (id, title, author, tags, curated) values
  ('b3333333-0000-0000-0000-000000000001','자동 캐릭터 책','작가Y','{동화}', true)`);
check('curated 책을 넣으면 기본 캐릭터가 생긴다',
  (await db.query(`select name from characters where book_id = 'b3333333-0000-0000-0000-000000000001'`)).rows[0]?.name === '자동 캐릭터 책 요정');
await db.exec(`insert into books (id, title, author, tags, curated) values
  ('b3333333-0000-0000-0000-000000000002','검색 유입 책','작가Y','{동화}', false)`);
check('curated 가 아니면 캐릭터가 안 생긴다',
  (await db.query(`select 1 from characters where book_id = 'b3333333-0000-0000-0000-000000000002'`)).rows.length === 0);
await db.exec(`update books set curated = true where id = 'b3333333-0000-0000-0000-000000000002'`);
check('나중에 curated 로 바뀌면 그때 생긴다',
  (await db.query(`select 1 from characters where book_id = 'b3333333-0000-0000-0000-000000000002'`)).rows.length === 1);

// ── 0016 아이템 샵 ────────────────────────────────────
const leaf = (await db.query(`select id, price from items where code = 'hat_leaf'`)).rows[0];
check('아이템 카탈로그는 학생 누구나 읽는다',
  (await as(S3, `select code from items`)).rows.length >= 6);
check('학생은 student_items 에 직접 못 넣는다',
  await denied(S1, `insert into student_items (student_id, item_id) values ('${S1}', '${leaf.id}')`));
const buyCall = (uid, student, item, role = 'service_role') => as(
  uid, `select id from buy_item('${student}'::uuid, '${item}'::uuid)`, role);
let studentBuyBlocked = false;
try { await buyCall(S1, S1, leaf.id, 'authenticated'); }
catch (e) { studentBuyBlocked = /permission denied/.test(e.message); }
check('학생 역할로는 buy_item 을 못 부른다 (service_role 전용)', studentBuyBlocked);

// S1 잔액: 이 시점의 원장 합계를 기준으로 본다
const balBefore = Number((await db.query(`select coalesce(sum(delta),0) as s from points_ledger where student_id = $1`, [S1])).rows[0].s);
check('구매 전 잔액이 나뭇잎 모자(100) 이상이다 (테스트 전제)', balBefore >= 100, `${balBefore}`);
const bought = await buyCall(null, S1, leaf.id);
const balAfter = Number((await db.query(`select coalesce(sum(delta),0) as s from points_ledger where student_id = $1`, [S1])).rows[0].s);
check('buy_item: 아이템이 지급되고 책갈피가 가격만큼 빠진다', bought.rows.length === 1 && balBefore - balAfter === 100, `${balBefore} → ${balAfter}`);
check('원장에 item_purchase 행이 student_items.id 를 가리킨다',
  (await db.query(`select 1 from points_ledger where reason = 'item_purchase' and ref_id = $1`, [bought.rows[0].id])).rows.length === 1);
check('학생은 자기 아이템을 읽는다', (await as(S1, `select item_id from student_items`)).rows.length === 1);
check('학생은 남의 아이템을 못 본다', (await as(S3, `select item_id from student_items`)).rows.length === 0);
let dup = false;
try { await buyCall(null, S1, leaf.id); } catch (e) { dup = /이미 가진/.test(e.message); }
check('같은 아이템을 두 번 못 산다', dup);
const crown = (await db.query(`select id from items where code = 'frame_gold'`)).rows[0];
let poor = false;
try { await buyCall(null, S3, crown.id); } catch (e) { poor = /모자라다/.test(e.message); }
check('잔액이 모자라면 못 산다 (S3, 금빛 액자 350)', poor);
check('실패한 구매는 원장에 아무것도 남기지 않는다',
  (await db.query(`select count(*)::int as n from points_ledger where student_id = $1 and reason = 'item_purchase'`, [S3])).rows[0].n === 0);

// ── 출력 ─────────────────────────────────────────────
const failed = results.filter(r => !r.ok);
for (const r of results) {
  console.log(`${r.ok ? 'ok  ' : 'FAIL'}  ${r.name}`);
  if (!r.ok) console.log(`        받은 값: ${r.detail}`);
}
console.log(`\n${results.length - failed.length}/${results.length} 통과`);
process.exit(failed.length ? 1 : 0);
