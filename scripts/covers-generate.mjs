/**
 * 책 표지 일러스트 배치 생성 — `npm run covers:generate` (미리보기) · `-- --write` (생성) · `-- --write --db` (DB 까지)
 *
 * 소유: 김민경 (CLAUDE.md §3). 2026-09-18, 제출 직전 한 번 돌리는 오프라인 배치다.
 *
 * 왜: 서재 56권(저작권 만료 원문)과 검색 유입 도서 대부분이 cover_url 이 없어 표지 퍼즐·도감·홈이
 * 전부 초록 자리표시자였다. 런타임 생성 파이프라인은 새 벤더·저장소·비동기 잡이 필요해 제출 전엔
 * 무리라, 우리가 한 번 생성해 `public/covers/<book_id>.webp` 로 커밋하고 books.cover_url 을 그리로 돌린다.
 * 런타임엔 아무 벤더도 안 붙는다 — 아이 데이터가 나갈 경로가 없다.
 *
 * 벤더: OpenAI Images (`gpt-image-1`). 입력은 책 제목·저자·장르·(서재면) 본문 앞부분뿐이다.
 * 정책 확인 2026-09-18: 미성년자 직접 이용에만 보호자 동의 조건이 있고 우리 구조엔 해당 없음.
 * 실존 인물·특정 화풍 지정 없음. 잔혹 장면은 프롬프트에서 뺀다 — 아이 화면이다.
 *
 * 재실행 안전: 파일이 이미 있으면 건너뛴다. 실패는 모아서 마지막에 찍는다.
 *   --scope curated (기본) | all      curated = 서재 56 + 시드 15. all 은 검색 유입분(교재 제외)까지
 *   --limit N                          N 권만
 *   --only "제목"                      한 권만 (재생성하려면 파일을 먼저 지운다)
 *   --model gpt-image-1  --quality medium  --size 1024x1536
 *   --concurrency N                    동시 요청 수 (기본 3, 429 가 잦으면 1)
 *   --sync-db                          생성은 안 하고 public/covers 에 있는 파일 전부를 books.cover_url 에 맞춘다
 */

import { createClient } from "@supabase/supabase-js";
import { existsSync, mkdirSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import sharp from "sharp";

const args = process.argv.slice(2);
const flag = (name, def) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : def; };
const has = (name) => args.includes(name);

const WRITE = has("--write");
const DB = has("--db");
const SYNC_DB = has("--sync-db");
const SCOPE = flag("--scope", "curated");
const LIMIT = Number(flag("--limit", "0")) || 0;
const ONLY = flag("--only", "");
const MODEL = flag("--model", "gpt-image-1");
const QUALITY = flag("--quality", "medium");
const SIZE = flag("--size", "1024x1536");
const CONCURRENCY = Number(flag("--concurrency", "3")) || 3;
const OUT_DIR = join(process.cwd(), "public", "covers");

function env(name) {
  const v = process.env[name]?.trim();
  if (!v) { console.error(`${name} 이 .env.local 에 없다`); process.exit(1); }
  return v;
}
const OPENAI_KEY = env("OPENAI_API_KEY");
const db = createClient(env("NEXT_PUBLIC_SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"), { auth: { persistSession: false } });

/* ── --sync-db: 파일 → DB 만 맞춘다 (배치를 여러 번 나눠 돌린 뒤 한 번에) ── */

if (SYNC_DB) {
  const ids = existsSync(OUT_DIR) ? readdirSync(OUT_DIR).filter((f) => f.endsWith(".webp")).map((f) => f.slice(0, -5)) : [];
  const { data: rows, error: e } = await db.from("books").select("id, title, cover_url").in("id", ids);
  if (e) { console.error(e.message); process.exit(1); }
  const stale = rows.filter((b) => b.cover_url !== `/covers/${b.id}.webp`);
  console.log(`파일 ${ids.length}개 · DB 와 다른 것 ${stale.length}건`);
  let n = 0;
  for (const b of stale) {
    const { error: ue } = await db.from("books").update({ cover_url: `/covers/${b.id}.webp` }).eq("id", b.id);
    if (ue) console.log(`  ✕ ${b.title}: ${ue.message}`); else n++;
  }
  console.log(`books.cover_url 갱신 ${n}건 (운영 DB)`);
  process.exit(0);
}

/* ── 대상 고르기 ─────────────────────────────────────── */

const { data: books, error } = await db
  .from("books")
  .select("id, title, author, tags, is_public_domain, curated, cover_url, target_grade_min")
  .order("is_public_domain", { ascending: false })
  .order("title");
if (error) { console.error(error.message); process.exit(1); }

let targets = books.filter((b) => !b.cover_url || b.cover_url.startsWith("/covers/"));
if (SCOPE === "curated") targets = targets.filter((b) => b.curated);
// 학습지·교재·웹툰은 태그가 없다 (#103) — 독후감 대상이 아니라 표지도 안 만든다
targets = targets.filter((b) => (b.tags ?? []).length > 0);
if (ONLY) targets = targets.filter((b) => b.title === ONLY);
targets = targets.filter((b) => !existsSync(join(OUT_DIR, `${b.id}.webp`)));
if (LIMIT) targets = targets.slice(0, LIMIT);

console.log(`${WRITE ? "생성" : "미리보기 (생성하려면 --write)"} — scope=${SCOPE} model=${MODEL} quality=${QUALITY} size=${SIZE}`);
console.log(`대상 ${targets.length}권 (이미 있는 파일은 뺌)\n`);

/* ── 프롬프트 ───────────────────────────────────────── */

const STYLE =
  "따뜻하고 부드러운 색감의 어린이 그림책 표지 일러스트. 초등학생이 좋아할 친근하고 둥근 그림체, " +
  "밝은 파스텔과 크림색 바탕, 종이 질감. 글자·제목·문자·로고·워터마크는 절대 넣지 말 것. " +
  "실존 인물 없음. 무섭거나 폭력적이거나 슬픈 장면은 넣지 말고, 이야기의 가장 밝고 상징적인 순간이나 " +
  "주인공을 한 장면으로. 세로형 책 표지 구도, 여백은 위쪽에.";

async function sceneHint(book) {
  if (!book.is_public_domain) return "";
  const { data } = await db.from("book_contents").select("body").eq("book_id", book.id).eq("chapter_no", 1).maybeSingle();
  const text = (data?.body ?? "").replace(/\s+/g, " ").slice(0, 400);
  return text ? `\n이야기 첫 부분: "${text}"` : "";
}

async function promptFor(book) {
  const genre = (book.tags ?? []).join(", ");
  const grade = book.target_grade_min ? `대상 독자: 초등 ${Math.min(book.target_grade_min, 6)}학년 무렵.` : "";
  return `${STYLE}\n\n책: 「${book.title}」 (${book.author}). 장르: ${genre}. ${grade}${await sceneHint(book)}`;
}

/* ── 생성 ───────────────────────────────────────────── */

async function generate(book) {
  const prompt = await promptFor(book);
  for (let attempt = 1; attempt <= 6; attempt++) {
    const res = await fetch("https://api.openai.com/v1/images/generations", {
      method: "POST",
      headers: { authorization: `Bearer ${OPENAI_KEY}`, "content-type": "application/json" },
      body: JSON.stringify({ model: MODEL, prompt, n: 1, size: SIZE, quality: QUALITY, output_format: "webp" }),
    });
    if (res.status === 429 || res.status >= 500) {
      const wait = 15000 * attempt;
      console.log(`  … ${book.title}: ${res.status}, ${wait / 1000}s 뒤 재시도`);
      await new Promise((r) => setTimeout(r, wait));
      continue;
    }
    const json = await res.json();
    if (!res.ok) throw new Error(json?.error?.message ?? `HTTP ${res.status}`);
    const b64 = json.data?.[0]?.b64_json;
    if (!b64) throw new Error("응답에 이미지가 없다");
    return { buf: Buffer.from(b64, "base64"), usage: json.usage };
  }
  throw new Error("재시도 초과");
}

if (!WRITE) {
  for (const b of targets) console.log(`  · ${b.title} (${b.author}) [${(b.tags ?? []).join(",")}] ${b.is_public_domain ? "서재" : b.curated ? "시드" : "검색"}`);
  console.log(`\n예상: ${targets.length}장 × 약 $0.04~0.07 (medium) — 생성하려면 --write`);
  process.exit(0);
}

mkdirSync(OUT_DIR, { recursive: true });
const done = []; const failed = [];
let idx = 0;
async function worker() {
  while (idx < targets.length) {
    const book = targets[idx++];
    const t0 = Date.now();
    try {
      const { buf: raw } = await generate(book);
      // 모델 원본은 1024×1536 · 2MB 안팎이다. 카드·퍼즐에는 600×900 이면 충분하고 저장소도 가볍다
      const buf = await sharp(raw).resize(600, 900, { fit: "cover" }).webp({ quality: 82 }).toBuffer();
      writeFileSync(join(OUT_DIR, `${book.id}.webp`), buf);
      done.push(book);
      console.log(`  ✓ ${book.title}  ${(buf.length / 1024).toFixed(0)}KB  ${((Date.now() - t0) / 1000).toFixed(0)}s`);
    } catch (e) {
      failed.push({ book, reason: e.message });
      console.log(`  ✕ ${book.title}: ${e.message}`);
    }
  }
}
await Promise.all(Array.from({ length: CONCURRENCY }, worker));

console.log(`\n생성 ${done.length} · 실패 ${failed.length}`);
for (const f of failed) console.log(`  ✕ ${f.book.title}: ${f.reason}`);

/* ── DB 반영 ────────────────────────────────────────── */

if (DB && done.length) {
  let n = 0;
  for (const b of done) {
    const { error: e } = await db.from("books").update({ cover_url: `/covers/${b.id}.webp` }).eq("id", b.id);
    if (e) console.log(`  ✕ cover_url 갱신 실패 ${b.title}: ${e.message}`); else n++;
  }
  console.log(`books.cover_url 갱신 ${n}건 (운영 DB)`);
} else if (done.length) {
  console.log("DB 는 안 건드렸다 — 운영 books.cover_url 까지 바꾸려면 --db");
}
