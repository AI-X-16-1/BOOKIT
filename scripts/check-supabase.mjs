/**
 * Supabase 연결 점검 — `npm run check:supabase`
 *
 * 소유: 김민경 (CLAUDE.md §3).
 *
 * .env.local 을 채운 뒤 이걸 돌리면 셋 중 무엇이 빠졌는지 바로 나온다:
 * 환경변수 · 스키마 적용 · 시드 · RLS.
 *
 * service_role 키는 있으면 쓰고 없으면 건너뛴다. 이 스크립트는 로컬에서만 돌고
 * 값을 어디로도 보내지 않는다.
 */

import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

/* ── .env.local 읽기 (dotenv 없이) ─────────────────── */

function loadEnv(path) {
  let raw;
  try {
    raw = readFileSync(path, "utf8");
  } catch {
    return {};
  }
  const out = {};
  for (const line of raw.split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);
    if (!m) continue;
    out[m[1]] = m[2].replace(/\s+#.*$/, "").trim().replace(/^["']|["']$/g, "");
  }
  return out;
}

const env = { ...loadEnv(".env.local"), ...process.env };
const results = [];
const check = (name, ok, detail = "") => {
  results.push({ name, ok, detail });
  console.log(`${ok ? "ok  " : "FAIL"}  ${name}${detail ? `  — ${detail}` : ""}`);
};

const url = env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !anonKey) {
  console.error(
    "NEXT_PUBLIC_SUPABASE_URL 과 NEXT_PUBLIC_SUPABASE_ANON_KEY 가 .env.local 에 있어야 한다.\n" +
      "README 의 'Supabase · 구글 로그인 설정' 1번을 먼저 끝낼 것.",
  );
  process.exit(1);
}

console.log(`대상: ${url}\n`);

const anon = createClient(url, anonKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

/* ── 1. 연결과 스키마 ───────────────────────────────── */

const books = await anon.from("books").select("id", { count: "exact", head: true });
check(
  "연결 + books 테이블 존재 (공개 읽기 정책)",
  !books.error,
  books.error?.message ?? `${books.count}권`,
);

if (books.error) {
  console.error("\n스키마가 아직 없다. SQL Editor 에서 마이그레이션을 먼저 적용할 것.");
  process.exit(1);
}

/* ── 2. RLS 가 실제로 막는가 ────────────────────────── */

const profiles = await anon.from("profiles").select("id").limit(1);
check(
  "RLS: 비로그인 상태에서 profiles 는 0행",
  !profiles.error && (profiles.data?.length ?? 0) === 0,
  profiles.error ? profiles.error.message : `${profiles.data?.length}행`,
);

const reviews = await anon.from("reviews").select("body").limit(1);
check(
  "§5 RLS: 비로그인 상태에서 독후감 본문은 0행",
  !reviews.error && (reviews.data?.length ?? 0) === 0,
  reviews.error ? reviews.error.message : `${reviews.data?.length}행`,
);

/* ── 3. 시드 ────────────────────────────────────────── */

if (!serviceKey) {
  console.log(
    "\nSUPABASE_SERVICE_ROLE_KEY 가 없어 시드 확인은 건너뛴다 (앱 동작에는 보호자 링크에서만 필요).",
  );
} else {
  const admin = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const classes = await admin.from("classes").select("join_code");
  check(
    "시드: 반 5개",
    !classes.error && classes.data?.length === 5,
    classes.error?.message ?? `${classes.data?.length}개 (${classes.data?.map((c) => c.join_code).join(", ")})`,
  );

  const badCode = classes.data?.find(
    (c) => !/^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$/.test(c.join_code),
  );
  check("시드: 참여 코드가 알파벳 규칙을 지킨다 (0/O/1/I 제외)", !badCode, badCode?.join_code ?? "");

  const students = await admin
    .from("profiles")
    .select("id", { count: "exact", head: true })
    .eq("role", "student");
  check(
    "시드: 학생 계정",
    !students.error && (students.count ?? 0) > 20,
    students.error?.message ?? `${students.count}명`,
  );

  const ranking = await admin.from("v_class_ranking").select("label, verified_count");
  check(
    "뷰: v_class_ranking 이 집계를 돌려준다",
    !ranking.error && (ranking.data?.length ?? 0) > 0,
    ranking.error?.message ??
      ranking.data
        ?.slice(0, 3)
        .map((r) => `${r.label} ${r.verified_count}`)
        .join(" · "),
  );
}

/* ── 4. 구글 provider ───────────────────────────────── */

const authSettings = await fetch(`${url}/auth/v1/settings`, {
  headers: { apikey: anonKey },
})
  .then((r) => r.json())
  .catch(() => null);

check(
  "구글 로그인 provider 활성화",
  authSettings?.external?.google === true,
  authSettings
    ? `켜진 provider: ${Object.entries(authSettings.external ?? {})
        .filter(([, on]) => on)
        .map(([name]) => name)
        .join(", ") || "없음"}`
    : "설정을 읽지 못했다",
);

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} 통과`);
process.exit(failed.length ? 1 : 0);
