/**
 * 데모 학생을 시드 상태로 되돌린다 — `npm run demo:reset` (미리보기) · `-- --write` (실행)
 *
 * 소유: 김민경 (CLAUDE.md §3). 제출 직전(9/20)과 심사 기간에 테스트 흔적을 지울 때 쓴다.
 * .env.local 의 SUPABASE_SERVICE_ROLE_KEY 로 운영 DB 에 직접 쓴다 — 그래서 기본은 미리보기다.
 *
 * 되돌리는 것 (supabase/seed.sql §5~§7b 의 값):
 *   - 기준일(SEED_CUTOFF) 이후 만들어진 독후감과 그 빈틈·검증·책갈피 원장 행 (통과 적립분)
 *   - 기준일 이후의 읽기 기록·체크포인트·아이템 구매(+원장 행)
 *   - 장르 도장판 → 성장소설 6 · 고전 3 · 동화 1
 *   - 연속 기록 → 7일 / 최장 12일, last_passed_on = 오늘(KST)  ← 심사자가 오늘 통과하면 이어진다
 *   - 캐릭터 → 통과한 시드 책 최종(2) · 금도끼 부화(1) · 운수 좋은 날 알(0), 그 외 삭제
 *   - 읽기 진행 → 금도끼 전 장 · 운수 좋은 날 1장
 * 그리고 잔액이 1,240 인지 확인한다. 시드 독후감 12편과 books 는 건드리지 않는다.
 */

import { createClient } from "@supabase/supabase-js";

const WRITE = process.argv.includes("--write");
const DEMO = "0000a001-0000-4000-8000-000000000001";
/** 시드가 만든 행은 전부 이 날짜 이전이다 (seed 의 created_at 은 now() - N days 로 과거) */
const SEED_CUTOFF = "2026-09-16T00:00:00Z";
const BOOK_GOLD_AXE = "0000b017-0000-4000-8000-000000000017"; // 금도끼 — 부화·퍼즐 완성
const BOOK_LUCKY_DAY = "0000b001-0000-4000-8000-000000000001"; // 운수 좋은 날 — 알·1장
const STAMPS = { 성장소설: 6, 고전: 3, 동화: 1 };
/** seed.sql 의 i=12 초고 본문. 시드 초고가 통과로 덮였을 때 되돌린다 (#159 ③) */
const SEED_DRAFT_BODY = "오늘부터 이 책을 읽기 시작했다. 아직 앞부분밖에 못 읽었는데";
const EXPECTED_BALANCE = 1240;
/** 통과작 9 + 금도끼(부화) + 운수 좋은 날(알). seed.sql §7b */
const EXPECTED_CHARACTERS = 11;

function env(name) {
  const v = process.env[name]?.trim();
  if (!v) throw new Error(`${name} 이 .env.local 에 없다`);
  return v;
}
const db = createClient(env("NEXT_PUBLIC_SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"), {
  auth: { persistSession: false },
});

const kstToday = new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10);
const log = (s) => console.log(s);
let touched = 0;

async function run(label, fn) {
  const n = await fn();
  touched += n;
  log(`  ${WRITE ? "✓" : "·"} ${label}: ${n}건`);
}

log(`${WRITE ? "실행" : "미리보기 (실제로 쓰려면 --write)"} — 데모 학생 ${DEMO.slice(0, 8)}, 기준일 ${SEED_CUTOFF.slice(0, 10)}\n`);

/* ── 1. 기준일 이후 독후감 체인 ───────────────────────── */
const { data: reviews } = await db
  .from("reviews").select("id, book_id, status, created_at, body")
  .eq("student_id", DEMO).gte("created_at", SEED_CUTOFF);
const reviewIds = (reviews ?? []).map((r) => r.id);
for (const r of reviews ?? []) log(`  - 독후감 ${r.id.slice(0, 8)} ${r.status.padEnd(11)} ${r.created_at.slice(5, 16)} | ${r.body.slice(0, 30)}`);

const { data: verifs } = reviewIds.length
  ? await db.from("verifications").select("id").in("review_id", reviewIds)
  : { data: [] };
const verifIds = (verifs ?? []).map((v) => v.id);

await run("책갈피 원장 (통과 적립분)", async () => {
  if (!verifIds.length) return 0;
  if (!WRITE) return (await db.from("points_ledger").select("id").in("ref_id", verifIds)).data?.length ?? 0;
  return (await db.from("points_ledger").delete().in("ref_id", verifIds).select()).data?.length ?? 0;
});
await run("검증 시도", async () => {
  if (!reviewIds.length) return 0;
  if (!WRITE) return verifIds.length;
  return (await db.from("verifications").delete().in("review_id", reviewIds).select()).data?.length ?? 0;
});
await run("빈틈", async () => {
  if (!reviewIds.length) return 0;
  if (!WRITE) return (await db.from("review_gaps").select("id").in("review_id", reviewIds)).data?.length ?? 0;
  return (await db.from("review_gaps").delete().in("review_id", reviewIds).select()).data?.length ?? 0;
});
await run("독후감", async () => {
  if (!reviewIds.length) return 0;
  if (!WRITE) return reviewIds.length;
  return (await db.from("reviews").delete().in("id", reviewIds).select()).data?.length ?? 0;
});

/* ── 1b. 시드 독후감에 붙은 테스트 흔적 (#159 ③) ─────────── */
// §1 은 "기준일 이후에 만들어진 **독후감**" 만 본다. 그런데 심사자나 우리가 시연 연습으로
// **시드 초고**(「운수 좋은 날」, 09-03)를 통과시키면 그 독후감 자신은 시드 데이터라 남아야
// 하지만 거기 붙은 검증·원장·빈틈은 테스트 흔적이다. 부모가 기준일 이전이어서 §1 의
// 그물에 걸리지 않았고, 그 결과 잔액이 1,290 으로 남고 초고가 passed 로 고착됐다.
// 여기서는 **행 자신의 created_at** 으로 잡는다.
//
// §1 이 이미 기준일 이후 독후감을 지웠으므로, 지금 남아 있는 "기준일 이후 검증" 은
// 정의상 시드 독후감에 붙은 것들이다.
// 시각 기준은 asked_at 이다 — verifications 에는 created_at 이 없다 (0003_reviews.sql).
// 이 select 의 error 를 확인하지 않으면, 컬럼을 틀려도 0건으로 조용히 넘어간다.
// 처음에 created_at 으로 썼다가 정확히 그렇게 지나갔다 — #159 ②와 같은 함정이다.
const { data: staleVerifs, error: svErr } = await db
  .from("verifications").select("id, review_id")
  .eq("student_id", DEMO).gte("asked_at", SEED_CUTOFF);
if (svErr) throw svErr;
const staleVerifIds = (staleVerifs ?? []).map((v) => v.id);
const touchedReviewIds = [...new Set((staleVerifs ?? []).map((v) => v.review_id))];

await run("시드 독후감의 책갈피 원장", async () => {
  if (!staleVerifIds.length) return 0;
  if (!WRITE) return (await db.from("points_ledger").select("id").in("ref_id", staleVerifIds)).data?.length ?? 0;
  return wrote(db.from("points_ledger").delete().in("ref_id", staleVerifIds));
});
await run("시드 독후감의 검증 시도", async () => {
  if (!staleVerifIds.length) return 0;
  if (!WRITE) return staleVerifIds.length;
  // 빈틈보다 먼저 — verifications.gap_id 가 review_gaps 를 참조한다 (FK 23503)
  return wrote(db.from("verifications").delete().in("id", staleVerifIds));
});

// 상태를 남은 검증으로 다시 정한다. 시드 초고는 검증이 하나도 없으므로 draft 로 돌아가고,
// 시드의 통과·실패 독후감은 자기 시드 검증이 남아 있어 그대로다. 본문은 초고만 덮어쓸 수
// 있으므로(saveDraft 가 draft 행만 고친다) draft 로 돌아간 것만 시드 본문으로 되돌린다.
await run("시드 독후감 상태·본문 복원", async () => {
  if (!touchedReviewIds.length) return 0;
  let n = 0;
  for (const id of touchedReviewIds) {
    const { data: left, error: lvErr } = await db
      .from("verifications").select("passed").eq("review_id", id);
    if (lvErr) throw lvErr;
    const status = !left?.length ? "draft" : left.some((v) => v.passed) ? "passed" : "failed";
    const { data: row, error: rowErr } = await db
      .from("reviews").select("status, body").eq("id", id).maybeSingle();
    if (rowErr) throw rowErr;
    if (!row) continue;

    const body = status === "draft" ? SEED_DRAFT_BODY : row.body;
    if (row.status === status && row.body === body) continue;

    log(`  - 독후감 ${id.slice(0, 8)} ${row.status} → ${status}${body === row.body ? "" : ", 본문 복원"}`);
    if (WRITE) {
      const { error } = await db
        .from("reviews")
        .update({ body, char_count: [...body].length, status, is_shared: false })
        .eq("id", id);
      if (error) throw error;
      // draft 로 돌아갔으면 빈틈도 테스트 흔적이다 (시드 초고에는 빈틈이 없다)
      if (status === "draft") {
        const { error: gErr } = await db.from("review_gaps").delete().eq("review_id", id);
        if (gErr) throw gErr;
      }
    }
    n += 1;
  }
  return n;
});

/* ── 2. 게임화 기록 (기준일 이후) ─────────────────────── */
await run("체크포인트", async () => {
  if (!WRITE) return (await db.from("checkpoints").select("id").eq("student_id", DEMO).gte("asked_at", SEED_CUTOFF)).data?.length ?? 0;
  return (await db.from("checkpoints").delete().eq("student_id", DEMO).gte("asked_at", SEED_CUTOFF).select()).data?.length ?? 0;
});
await run("아이템 구매 원장", async () => {
  const { data: items } = await db.from("student_items").select("id").eq("student_id", DEMO);
  const ids = (items ?? []).map((i) => i.id);
  if (!ids.length) return 0;
  if (!WRITE) return (await db.from("points_ledger").select("id").in("ref_id", ids)).data?.length ?? 0;
  return (await db.from("points_ledger").delete().in("ref_id", ids).select()).data?.length ?? 0;
});
await run("아이템", async () => {
  if (!WRITE) return (await db.from("student_items").select("id").eq("student_id", DEMO)).data?.length ?? 0;
  return (await db.from("student_items").delete().eq("student_id", DEMO).select()).data?.length ?? 0;
});

/* ── 3. 시드 값으로 복원 ─────────────────────────────── */
/**
 * insert/upsert 한 행 수. **오류를 삼키지 않는다** (#159).
 *
 * 예전에는 `(await q.select()).data?.length ?? 0` 이었다. 그러면 쓰기가 통째로 실패해도
 * 0 을 돌려주고 "… : 0건" 으로 정상처럼 찍힌다 — 바로 앞에서 delete 를 한 단계들이라
 * 표가 빈 채로 남고, 그걸 아무도 모른다. 실제로 도감이 그렇게 비었다.
 */
async function wrote(query) {
  const { data, error } = await query.select();
  if (error) throw error;
  return data?.length ?? 0;
}

await run("도장판 → 성장소설 6 · 고전 3 · 동화 1", async () => {
  if (!WRITE) return 1;
  await db.from("genre_stamps").delete().eq("student_id", DEMO);
  const rows = Object.entries(STAMPS).map(([genre, completed_count]) => ({ student_id: DEMO, genre, completed_count }));
  return wrote(db.from("genre_stamps").insert(rows));
});
await run(`연속 기록 → 7 / 12, last_passed_on ${kstToday}`, async () => {
  if (!WRITE) return 1;
  return wrote(
    db.from("streaks").upsert({ student_id: DEMO, current_days: 7, longest_days: 12, last_passed_on: kstToday }),
  );
});
await run("읽기 진행 → 금도끼 전 장 · 운수 좋은 날 1장", async () => {
  if (!WRITE) return 1;
  await db.from("reading_progress").delete().eq("student_id", DEMO);
  const { data: ch } = await db.from("book_contents").select("chapter_no").eq("book_id", BOOK_GOLD_AXE);
  const rows = (ch ?? []).map((c) => ({ student_id: DEMO, book_id: BOOK_GOLD_AXE, chapter_no: c.chapter_no }));
  rows.push({ student_id: DEMO, book_id: BOOK_LUCKY_DAY, chapter_no: 1 });
  // reading_progress 트리거가 캐릭터를 만들지만 stage 는 아래에서 다시 맞춘다
  return wrote(db.from("reading_progress").insert(rows));
});
await run("캐릭터 → 통과작 최종 2 · 금도끼 1 · 운수 좋은 날 0", async () => {
  if (!WRITE) return 1;
  await db.from("student_characters").delete().eq("student_id", DEMO);
  const { data: passed } = await db.from("reviews").select("book_id").eq("student_id", DEMO).eq("status", "passed");
  const { data: chars } = await db.from("characters").select("book_id");
  const has = new Set((chars ?? []).map((c) => c.book_id));
  // 책 하나당 한 행만 남긴다. 고정 두 권이 통과 목록을 이긴다 — 시드의 뜻이
  // "운수 좋은 날은 알, 금도끼는 부화" 이기 때문이다.
  //
  // 접지 않으면: 「운수 좋은 날」을 통과시킨 적이 있으면 passed 에도 들어 있어 같은
  // (student_id, book_id) 가 배치에 두 번 들어간다. Postgres 는 한 ON CONFLICT 문이
  // 같은 행을 두 번 건드리는 것을 거절하고(21000), 바로 위에서 delete 를 한 뒤라
  // 도감이 빈 채로 남는다 (#159).
  const byBook = new Map();
  for (const r of (passed ?? []).filter((r) => has.has(r.book_id))) {
    byBook.set(r.book_id, { student_id: DEMO, book_id: r.book_id, stage: 2 });
  }
  byBook.set(BOOK_GOLD_AXE, { student_id: DEMO, book_id: BOOK_GOLD_AXE, stage: 1 });
  byBook.set(BOOK_LUCKY_DAY, { student_id: DEMO, book_id: BOOK_LUCKY_DAY, stage: 0 });

  return wrote(
    db.from("student_characters").upsert([...byBook.values()], { onConflict: "student_id,book_id" }),
  );
});

/* ── 4. 확인 ─────────────────────────────────────────── */
const { data: led } = await db.from("points_ledger").select("delta").eq("student_id", DEMO);
const balance = (led ?? []).reduce((s, x) => s + x.delta, 0);
const { count: reviewCount } = await db.from("reviews").select("id", { count: "exact", head: true }).eq("student_id", DEMO);
// 도감 행 수도 본다 — 캐릭터 단계가 조용히 비는 일이 있었다 (#159)
const { count: charCount } = await db
  .from("student_characters")
  .select("book_id", { count: "exact", head: true })
  .eq("student_id", DEMO);
log(
  `
잔액 ${balance} (기대 ${EXPECTED_BALANCE}) · 독후감 ${reviewCount}편 (기대 12) · 도감 ${charCount}마리 (기대 ${EXPECTED_CHARACTERS})`,
);
if (
  WRITE &&
  (balance !== EXPECTED_BALANCE || reviewCount !== 12 || charCount !== EXPECTED_CHARACTERS)
) {
  log("✕ 시드 값과 다르다 — 원장이나 독후감에 기준일 이전 테스트 행이 있을 수 있다. 손으로 확인할 것");
  process.exit(1);
}
log(WRITE ? `\n완료 — ${touched}건 처리` : `\n미리보기 끝 — 실제로 되돌리려면: npm run demo:reset -- --write`);
