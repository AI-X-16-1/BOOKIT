/**
 * 데모 학생을 시드 상태로 되돌린다 — `npm run demo:reset` (미리보기) · `-- --write` (실행)
 *
 * 소유: 김민경 (CLAUDE.md §3). 제출 직전(9/20)과 심사 기간에 테스트 흔적을 지울 때 쓴다.
 * .env.local 의 SUPABASE_SERVICE_ROLE_KEY 로 운영 DB 에 직접 쓴다 — 그래서 기본은 미리보기다.
 *
 * 되돌리는 것 (supabase/seed.sql §5~§7b 의 값):
 *   - 기준일(SEED_CUTOFF) 이후 만들어진 독후감과 그 빈틈·검증·책갈피 원장 행 (통과 적립분)
 *   - 시드 독후감에 기준일 이후 붙은 검증·원장 (#159 — 시드 초고 「운수 좋은 날」을 통과시키면
 *     부모는 시드 행이라 자식만 새로 생긴다). 그 독후감의 status·본문도 seed 값으로
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
/** seed.sql §5 v_books 순서 — 1~9 passed, 10~11 failed, 12 draft. 시드가 바뀌면 여기도 */
const SEED_REVIEWS = {
  "0000b005-0000-4000-8000-000000000005": "passed",
  "0000b006-0000-4000-8000-000000000006": "passed",
  "0000b007-0000-4000-8000-000000000007": "passed",
  "0000b008-0000-4000-8000-000000000008": "passed",
  "0000b009-0000-4000-8000-000000000009": "passed",
  "0000b010-0000-4000-8000-000000000010": "passed",
  "0000b002-0000-4000-8000-000000000002": "passed",
  "0000b012-0000-4000-8000-000000000012": "passed",
  "0000b013-0000-4000-8000-000000000013": "passed",
  "0000b004-0000-4000-8000-000000000004": "failed",
  "0000b015-0000-4000-8000-000000000015": "failed",
  [BOOK_LUCKY_DAY]: "draft",
};
const SEED_DRAFT_BODY = "오늘부터 이 책을 읽기 시작했다. 아직 앞부분밖에 못 읽었는데";
const EXPECTED_BALANCE = 1240;
/** 통과작 9 + 금도끼(부화) + 운수 좋은 날(알) */
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
/** supabase-js 는 실패해도 throw 하지 않는다 — 여기서 멈춘다 (#159: 실패를 삼키고 지나가 도감이 비었다) */
function must(res, label) {
  if (res.error) { console.error(`✕ ${label}: ${res.error.message}`); process.exit(1); }
  return res;
}
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

/* ── 1b. 시드 독후감에 기준일 이후 붙은 것 (#159) ───────── */
// 시드 초고·실패작에 심사자가 답하면 검증·원장은 새로 생기지만 독후감은 시드 행이라 위에서 안 잡힌다.
const seedIds = Object.keys(SEED_REVIEWS);
const { data: seedRows } = must(await db.from("reviews").select("id, book_id, status").eq("student_id", DEMO).in("book_id", seedIds), "시드 독후감 조회");
const seedReviewIds = (seedRows ?? []).map((r) => r.id);
const { data: lateVerifs } = must(await db.from("verifications").select("id, review_id").in("review_id", seedReviewIds.length ? seedReviewIds : ["00000000-0000-0000-0000-000000000000"]).gte("asked_at", SEED_CUTOFF), "시드 독후감의 늦은 검증 조회");
const lateVerifIds = (lateVerifs ?? []).map((v) => v.id);
await run("시드 독후감의 기준일 이후 책갈피 원장", async () => {
  if (!lateVerifIds.length) return 0;
  if (!WRITE) return (await db.from("points_ledger").select("id").in("ref_id", lateVerifIds)).data?.length ?? 0;
  return must(await db.from("points_ledger").delete().in("ref_id", lateVerifIds).select(), "원장 삭제").data.length;
});
await run("시드 독후감의 기준일 이후 검증", async () => {
  if (!lateVerifIds.length) return 0;
  if (!WRITE) return lateVerifIds.length;
  return must(await db.from("verifications").delete().in("id", lateVerifIds).select(), "검증 삭제").data.length;
});
await run("시드 독후감 status·본문 복원", async () => {
  let n = 0;
  for (const r of seedRows ?? []) {
    const want = SEED_REVIEWS[r.book_id];
    if (r.status === want) continue;
    log(`    · ${r.book_id.slice(0, 8)} ${r.status} → ${want}`);
    n++;
    if (!WRITE) continue;
    if (want === "draft") {
      // 시드 초고는 빈틈이 없다 — 제출로 생긴 빈틈을 지우고 본문도 seed 원문으로
      must(await db.from("review_gaps").delete().eq("review_id", r.id), "초고 빈틈 삭제");
      must(await db.from("reviews").update({ status: "draft", body: SEED_DRAFT_BODY, char_count: SEED_DRAFT_BODY.length }).eq("id", r.id), "초고 복원");
    } else {
      must(await db.from("reviews").update({ status: want }).eq("id", r.id), "status 복원");
    }
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
await run("도장판 → 성장소설 6 · 고전 3 · 동화 1", async () => {
  if (!WRITE) return 1;
  await db.from("genre_stamps").delete().eq("student_id", DEMO);
  const rows = Object.entries(STAMPS).map(([genre, completed_count]) => ({ student_id: DEMO, genre, completed_count }));
  return (await db.from("genre_stamps").insert(rows).select()).data?.length ?? 0;
});
await run(`연속 기록 → 7 / 12, last_passed_on ${kstToday}`, async () => {
  if (!WRITE) return 1;
  return (await db.from("streaks").upsert({ student_id: DEMO, current_days: 7, longest_days: 12, last_passed_on: kstToday }).select()).data?.length ?? 0;
});
await run("읽기 진행 → 금도끼 전 장 · 운수 좋은 날 1장", async () => {
  if (!WRITE) return 1;
  await db.from("reading_progress").delete().eq("student_id", DEMO);
  const { data: ch } = await db.from("book_contents").select("chapter_no").eq("book_id", BOOK_GOLD_AXE);
  const rows = (ch ?? []).map((c) => ({ student_id: DEMO, book_id: BOOK_GOLD_AXE, chapter_no: c.chapter_no }));
  rows.push({ student_id: DEMO, book_id: BOOK_LUCKY_DAY, chapter_no: 1 });
  // reading_progress 트리거가 캐릭터를 만들지만 stage 는 아래에서 다시 맞춘다
  return (await db.from("reading_progress").insert(rows).select()).data?.length ?? 0;
});
await run("캐릭터 → 통과작 최종 2 · 금도끼 1 · 운수 좋은 날 0", async () => {
  if (!WRITE) return 1;
  const { data: passed } = must(await db.from("reviews").select("book_id").eq("student_id", DEMO).eq("status", "passed"), "통과작 조회");
  const { data: chars } = must(await db.from("characters").select("book_id"), "카탈로그 조회");
  const has = new Set((chars ?? []).map((c) => c.book_id));
  // 같은 책이 두 번 들어가면 upsert 가 통째로 실패한다 (#159 의 원인) — Map 으로 하나씩, 높은 stage 우선
  const want = new Map();
  for (const r of passed ?? []) if (has.has(r.book_id)) want.set(r.book_id, 2);
  if (!want.has(BOOK_GOLD_AXE)) want.set(BOOK_GOLD_AXE, 1);
  if (!want.has(BOOK_LUCKY_DAY)) want.set(BOOK_LUCKY_DAY, 0);
  const rows = [...want].map(([book_id, stage]) => ({ student_id: DEMO, book_id, stage }));
  // 먼저 넣고(upsert) 그다음 남는 것을 지운다 — 지우고 넣다 실패하면 도감이 빈 채로 남는다
  const up = must(await db.from("student_characters").upsert(rows, { onConflict: "student_id,book_id" }).select(), "캐릭터 upsert");
  must(await db.from("student_characters").delete().eq("student_id", DEMO).not("book_id", "in", `(${[...want.keys()].join(",")})`), "캐릭터 정리");
  return up.data.length;
});

/* ── 4. 확인 ─────────────────────────────────────────── */
const { data: led } = await db.from("points_ledger").select("delta").eq("student_id", DEMO);
const balance = (led ?? []).reduce((s, x) => s + x.delta, 0);
const { data: allReviews } = await db.from("reviews").select("status, book_id, body").eq("student_id", DEMO);
const reviewCount = (allReviews ?? []).length;
const byStatus = { passed: 0, failed: 0, draft: 0 };
for (const r of allReviews ?? []) byStatus[r.status] = (byStatus[r.status] ?? 0) + 1;
const draftOk = (allReviews ?? []).some((r) => r.book_id === BOOK_LUCKY_DAY && r.status === "draft" && r.body === SEED_DRAFT_BODY);
const { count: charCount } = await db.from("student_characters").select("book_id", { count: "exact", head: true }).eq("student_id", DEMO);
log(`
잔액 ${balance} (기대 ${EXPECTED_BALANCE}) · 독후감 ${reviewCount}편 (기대 12: passed ${byStatus.passed}/9 · failed ${byStatus.failed}/2 · draft ${byStatus.draft}/1) · 운수 좋은 날 초고 ${draftOk ? "seed 그대로" : "다름"} · 캐릭터 ${charCount}마리 (기대 ${EXPECTED_CHARACTERS})`);
const consistent = balance === EXPECTED_BALANCE && reviewCount === 12 && byStatus.passed === 9 && byStatus.failed === 2 && byStatus.draft === 1 && draftOk && charCount === EXPECTED_CHARACTERS;
if (WRITE && !consistent) {
  log("✕ 시드 값과 다르다 — 원장이나 독후감에 기준일 이전 테스트 행이 있을 수 있다. 손으로 확인할 것");
  process.exit(1);
}
log(WRITE ? `\n완료 — ${touched}건 처리` : `\n미리보기 끝 — 실제로 되돌리려면: npm run demo:reset -- --write`);
