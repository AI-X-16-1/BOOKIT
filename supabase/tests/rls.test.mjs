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

// ── 출력 ─────────────────────────────────────────────
const failed = results.filter(r => !r.ok);
for (const r of results) {
  console.log(`${r.ok ? 'ok  ' : 'FAIL'}  ${r.name}`);
  if (!r.ok) console.log(`        받은 값: ${r.detail}`);
}
console.log(`\n${results.length - failed.length}/${results.length} 통과`);
process.exit(failed.length ? 1 : 0);
