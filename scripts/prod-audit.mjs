/**
 * 프로덕션 점검 — `npm run audit:prod` (기본 https://bookit-edu.vercel.app, `--base <url>` 로 바꾼다)
 *
 * 소유: 김민경 (CLAUDE.md §3). 제출 직전(9/20)과 심사 기간에 돌린다.
 *
 * 시연 로그인(/auth/demo)으로 학생·교사 세션을 얻어 HTTP 로만 확인한다 — DB 키가 필요 없고,
 * 심사자가 실제로 밟는 경로 그대로다. 보는 것:
 *   1. 접속·시연 로그인·핵심 API 가 살아 있는가
 *   2. 교사가 학생 화면·학생 API 에 못 들어가고, 학생이 교사 API 에 못 들어가는가 (라우팅 + RLS)
 *   3. 교사·보호자 응답에 독후감 본문(body)·답변(answer)이 절대 없는가 (CLAUDE.md §5)
 *   4. 법적 고지 페이지가 열리는가
 *
 * 실패는 FAIL 줄로 찍고 exit 1. 서비스에 쓰는 건 보호자 링크 발급(이미 있으면 같은 링크) 뿐이다.
 */

const BASE = (() => {
  const i = process.argv.indexOf("--base");
  return (i > 0 ? process.argv[i + 1] : "https://bookit-edu.vercel.app").replace(/\/$/, "");
})();

/* ── 아주 작은 쿠키 항아리 ─────────────────────────── */

class Jar {
  constructor() { this.cookies = new Map(); }
  absorb(res) {
    const set = res.headers.getSetCookie?.() ?? [];
    for (const line of set) {
      const [pair] = line.split(";");
      const eq = pair.indexOf("=");
      if (eq < 0) continue;
      const name = pair.slice(0, eq).trim();
      const value = pair.slice(eq + 1).trim();
      if (value === "" || /max-age=0/i.test(line)) this.cookies.delete(name);
      else this.cookies.set(name, value);
    }
  }
  header() { return [...this.cookies].map(([k, v]) => `${k}=${v}`).join("; "); }
}

async function get(jar, path, { follow = 0 } = {}) {
  let url = BASE + path;
  let res;
  for (let hop = 0; hop <= follow; hop++) {
    res = await fetch(url, { headers: jar ? { cookie: jar.header() } : {}, redirect: "manual" });
    jar?.absorb(res);
    const loc = res.headers.get("location");
    if (res.status >= 300 && res.status < 400 && loc && hop < follow) {
      url = loc.startsWith("http") ? loc : BASE + loc;
      continue;
    }
    break;
  }
  return res;
}

async function json(res) {
  try { return await res.json(); } catch { return null; }
}

/* ── 결과 수집 ───────────────────────────────────────── */

const results = [];
function check(name, ok, detail = "") {
  results.push({ name, ok, detail });
  console.log(`${ok ? "ok  " : "FAIL"}  ${name}${!ok && detail ? `\n        받은 값: ${detail}` : ""}`);
}

/** 응답 JSON 어디에도 body / answer 키가 없는가 (CLAUDE.md §5) */
function hasForbiddenKeys(value, path = "") {
  if (Array.isArray(value)) return value.map((v, i) => hasForbiddenKeys(v, `${path}[${i}]`)).find(Boolean) ?? "";
  if (value && typeof value === "object") {
    for (const [k, v] of Object.entries(value)) {
      if (k === "body" || k === "answer") return `${path}.${k}`;
      const hit = hasForbiddenKeys(v, `${path}.${k}`);
      if (hit) return hit;
    }
  }
  return "";
}

/* ── 1. 접속 ─────────────────────────────────────────── */

console.log(`base: ${BASE}\n`);

const login = await get(null, "/login");
check("로그인 화면 200 (Deployment Protection 없음)", login.status === 200, `${login.status}`);
const loginHtml = await login.text();
check("로그인 화면에 시연 카드 (DEMO_LOGIN_ENABLED)", loginHtml.includes("auth/demo?as=student"));
check("로그인 화면에 개인정보처리방침·이용약관 링크", loginHtml.includes("/privacy") && loginHtml.includes("/terms"));
for (const p of ["/privacy", "/terms"]) {
  const r = await get(null, p);
  check(`${p} 200 (로그인 없이)`, r.status === 200, `${r.status}`);
}
const anonHome = await get(null, "/home");
check("비로그인 /home → /login", anonHome.status === 307 && /\/login/.test(anonHome.headers.get("location") ?? ""), `${anonHome.status} ${anonHome.headers.get("location")}`);

/* ── 2. 학생 세션 ────────────────────────────────────── */

const student = new Jar();
const sDemo = await get(student, "/auth/demo?as=student");
check("시연 로그인(학생) 307", sDemo.status === 307, `${sDemo.status}`);
const sProfile = await json(await get(student, "/api/profile"));
check("학생 /api/profile — 민서 · student", sProfile?.data?.display_name === "민서" && sProfile?.data?.role === "student", JSON.stringify(sProfile)?.slice(0, 120));
for (const p of ["/api/points", "/api/growth", "/api/ranking/class", "/api/characters", "/api/items", "/api/books/recommend"]) {
  const r = await get(student, p);
  const d = await json(r);
  check(`학생 ${p} 200 + data`, r.status === 200 && d && "data" in d, `${r.status} ${JSON.stringify(d)?.slice(0, 80)}`);
}
for (const p of ["/home", "/library", "/collection", "/me", "/write", "/level-test"]) {
  const r = await get(student, p);
  check(`학생 ${p} 200`, r.status === 200, `${r.status} ${r.headers.get("location") ?? ""}`);
}
for (const p of ["/api/teacher/class", "/api/teacher/students", "/api/teacher/ranking"]) {
  const r = await get(student, p);
  check(`학생이 ${p} 를 부르면 거부 (401/403/404)`, [401, 403, 404].includes(r.status), `${r.status}`);
}
const sTeacherPage = await get(student, "/teacher");
check("학생 /teacher → /home 리다이렉트", sTeacherPage.status === 307 && /\/home/.test(sTeacherPage.headers.get("location") ?? ""), `${sTeacherPage.status} ${sTeacherPage.headers.get("location")}`);

// 보호자 링크 — 학생이 발급(이미 있으면 같은 링크), 익명으로 조회
const linkRes = await fetch(BASE + "/api/guardian/link", { method: "POST", headers: { cookie: student.header(), "content-type": "application/json" }, body: "{}" });
const link = await json(linkRes);
const guardianUrl = link?.data?.url ?? "";
check("학생 보호자 링크 발급", linkRes.status === 200 && /\/guardian\//.test(guardianUrl), `${linkRes.status} ${JSON.stringify(link)?.slice(0, 100)}`);
if (guardianUrl) {
  const token = guardianUrl.split("/guardian/")[1];
  const g = await get(null, `/api/guardian/${token}`);
  const gd = await json(g);
  check("보호자 API 익명 200", g.status === 200 && gd?.data, `${g.status}`);
  const leak = hasForbiddenKeys(gd);
  check("보호자 응답에 body/answer 없음 (§5)", !leak, leak);
  const gp = await get(null, `/guardian/${token}`);
  check("보호자 화면 익명 200", gp.status === 200, `${gp.status}`);
}

// POST 라우트(/api/checkpoints · /api/level-test · /api/reviews · /api/items/:id/buy)는
// 여기서 부르지 않는다 — 부르는 순간 데모 계정에 행이 생겨서, 심사 직전에 돌리는
// 점검이 시드를 더럽히는 꼴이 된다. 그 경로들은 `npm run demo:reset` 의 시드 대조와
// 손 시연으로 본다 (#159 에서 실제로 그 문제를 겪었다).

/* ── 3. 교사 세션 ────────────────────────────────────── */

const teacher = new Jar();
const tDemo = await get(teacher, "/auth/demo?as=teacher");
check("시연 로그인(교사) 307", tDemo.status === 307, `${tDemo.status}`);
const tProfile = await json(await get(teacher, "/api/profile"));
check("교사 /api/profile — teacher", tProfile?.data?.role === "teacher", JSON.stringify(tProfile)?.slice(0, 120));
for (const p of ["/api/teacher/class", "/api/teacher/students", "/api/teacher/ranking"]) {
  const r = await get(teacher, p);
  const d = await json(r);
  check(`교사 ${p} 200 + data`, r.status === 200 && d && "data" in d, `${r.status}`);
  const leak = hasForbiddenKeys(d);
  check(`교사 ${p} 응답에 body/answer 없음 (§5)`, !leak, leak);
}
for (const p of ["/home", "/library", "/collection", "/me", "/write", "/challenge", "/level-test"]) {
  const r = await get(teacher, p);
  check(`교사 ${p} → /teacher 리다이렉트`, r.status === 307 && /\/teacher/.test(r.headers.get("location") ?? ""), `${r.status} ${r.headers.get("location") ?? ""}`);
}
const tPage = await get(teacher, "/teacher");
check("교사 /teacher 200", tPage.status === 200, `${tPage.status}`);
// 교사가 학생용 API 를 부르면 자기 데이터도 없고 남의 것도 없어야 한다
const tPoints = await json(await get(teacher, "/api/points"));
check("교사 /api/points — 잔액 0 (남의 원장 안 보임)", tPoints?.data?.balance === 0 || tPoints?.error, JSON.stringify(tPoints)?.slice(0, 100));
const tChars = await json(await get(teacher, "/api/characters"));
const ownedByTeacher = (tChars?.data?.characters ?? []).filter((c) => c.stage > 0 || c.obtained_at).length;
check("교사 /api/characters — 가진 캐릭터 0 (도감은 학생 것 안 보임)", ownedByTeacher === 0, `${ownedByTeacher}`);

// 시연 계정 탈퇴 차단
const del = await fetch(BASE + "/api/profile", { method: "DELETE", headers: { cookie: student.header() } });
check("시연 계정 탈퇴 차단 (403 demo_account)", del.status === 403, `${del.status}`);

/* ── 출력 ────────────────────────────────────────────── */

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} 통과${failed.length ? ` — 실패 ${failed.length}` : ""}`);
process.exit(failed.length ? 1 : 0);
