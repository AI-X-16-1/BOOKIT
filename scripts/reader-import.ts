/**
 * 책잇 서재 책 추가 — `npm run reader:import`. owner: 강민구
 *
 *   npm run reader:import            무엇이 들어갈지만 보여준다 (기본: 쓰기 없음)
 *   npm run reader:import -- --write 실제로 books · book_contents 에 넣는다
 *   npm run reader:import -- --only "금도끼,땡볕"
 *
 * 출처는 위키문헌(ko.wikisource.org)이다. 저작권이 만료된 글만 고른다 —
 * 방정환(1931)·김유정(1937)·현진건(1943)은 사후 70년이 지났다.
 * 목록은 scripts/fixtures/shelf-candidates.json 에 있다.
 *
 * 왜 필요한가: 서재는 "읽고 나서 쓴다" 흐름의 유일한 경로인데 14권뿐이었고,
 * 그중 초1~2 가 2권이었다 (#106). 국립중앙도서관 관외이용 원문은 늘어나지 않는다 —
 * 우리 책 93권을 ISBN 으로 전수 조회해 0/86 이었다. 늘릴 수 있는 것은 서재뿐이다.
 *
 * 넣기 전에 사람이 본문을 확인한다. 옛 작품에는 초등학생 화면에 띄우기 곤란한
 * 표현이 섞여 있다 — 미리보기가 각 장의 첫 문장을 찍는 이유다.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import candidates from "./fixtures/shelf-candidates.json";

const API = "https://ko.wikisource.org/w/api.php";
const UA = "bookit-contest/1.0 (educational reading app for Korean students)";
/** 위키문헌에 부담을 주지 않는 간격 */
const SPACING_MS = 2500;
/** 한 장의 목표 길이. 서재 뷰어가 쪽으로 나누므로 장은 읽기 단위다 */
const CHAPTER_CHARS = 4000;

interface Candidate {
  src: string;
  title?: string;
  author: string;
  grade: [number, number];
  tags: string[];
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function fetchPlainText(title: string): Promise<string | null> {
  const url = new URL(API);
  url.searchParams.set("action", "query");
  url.searchParams.set("prop", "extracts");
  url.searchParams.set("explaintext", "1");
  url.searchParams.set("exlimit", "1");
  url.searchParams.set("redirects", "1");
  url.searchParams.set("titles", title);
  url.searchParams.set("format", "json");

  // 위키문헌은 몰아치면 429 를 준다. 물러섰다 다시 한다
  let res: Response | null = null;
  for (let wait = 2000, tries = 0; tries < 4; tries += 1, wait = Math.min(wait * 2, 30000)) {
    res = await fetch(url, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(20000) });
    if (res.status !== 429) break;
    await sleep(wait);
  }
  if (!res || !res.ok) return null;
  const body = (await res.json()) as {
    query?: { pages?: Record<string, { extract?: string; missing?: string }> };
  };
  const page = Object.values(body.query?.pages ?? {})[0];
  if (!page || page.missing !== undefined) return null;
  return page.extract ?? null;
}

/** 위키문헌 본문에서 각주·출처 꼬리와 빈 줄을 정리한다 */
function clean(raw: string): string {
  return raw
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .filter((line) => !/^(저작권|이 저작물|원본 주소|분류:|＊|\*)/.test(line))
    // 위키문헌 섹션 제목(== 1 ==)은 장 제목으로 따로 붙이므로 본문에서 뺀다
    .filter((line) => !/^=+\s*.*\s*=+$/.test(line))
    .join("\n\n");
}

/**
 * 옛 표기로 남아 있는 판본을 가려낸다.
 *
 * 위키문헌에는 같은 작품이라도 현대 표기로 정리된 것과 1920~30년대 표기 그대로인 것이
 * 섞여 있다. 후자는 초등학생이 읽을 수 없다 — 실제로 「귀먹은 집오리」가 이렇다:
 * "하—얏코 어엽븐 집오리 두 마리가 길리우고 잇섯슴니다".
 * 아래 표지들이 본문에 여러 번 나오면 넣지 않는다.
 */
const ARCHAIC_RE = /잇섯|엇슴|슴니다|헛습|하엿|하얏|업섯|만흔|갓치|엿습|엿다|첫재|둘재|어엽|칼국슈|하야서/g;

function archaicHits(text: string): number {
  return (text.match(ARCHAIC_RE) ?? []).length;
}

/** 문단을 모아 장으로 나눈다. 짧은 글은 한 장이다 */
function toChapters(text: string): string[] {
  const paras = text.split("\n\n");
  if (text.length <= CHAPTER_CHARS * 1.5) return [text];

  const chapters: string[] = [];
  let buf = "";
  for (const p of paras) {
    if (buf.length + p.length > CHAPTER_CHARS && buf.length > 0) {
      chapters.push(buf);
      buf = "";
    }
    buf = buf ? `${buf}\n\n${p}` : p;
  }
  if (buf.trim().length > 0) chapters.push(buf);
  return chapters;
}

/**
 * 시드와 같은 모양의 고정 id — 운영 DB 와 seed.sql 이 같은 값을 쓰게 한다.
 *
 * 자리는 **후보 목록 전체**에서의 순번으로 정한다. 걸러낸 목록의 순번을 쓰면
 * `--only "땡볕"` 처럼 한 권만 다시 돌릴 때 그 책이 0번이 되어 `0000b101`(겁쟁이 도적)을
 * 덮어쓴다 — `on conflict (id) do update` 라 조용히 지워진다 (#108 리뷰, 문민재).
 *
 * 그래서 후보는 **뒤에만 추가**한다. 중간에 끼워 넣으면 뒷 책들의 id 가 밀리는데,
 * 그건 아래 assertSlotMatches 가 막는다.
 */
function bookId(indexInCandidates: number): string {
  const n = String(indexInCandidates + 101).padStart(3, "0");
  return `0000b${n}-0000-4000-8000-000000000${n}`;
}

/**
 * 이 id 자리에 이미 다른 책이 들어 있으면 멈춘다.
 *
 * 후보 목록을 중간에 끼워 넣거나 순서를 바꾸면 id 가 밀려 남의 책을 덮어쓴다.
 * 제목이 다르면 쓰지 않고 건너뛴다 — 데이터를 잃는 것보다 한 권 못 넣는 게 낫다.
 */
async function slotIsFree(
  db: SupabaseClient,
  id: string,
  title: string,
): Promise<boolean> {
  const { data } = await db.from("books").select("title").eq("id", id).maybeSingle();
  if (!data || data.title === title) return true;
  console.log(
    `      ✕ ${id} 자리에 이미 "${data.title}" 가 있다. 후보 순서가 바뀐 것 같다 — 넣지 않는다`,
  );
  return false;
}

async function main() {
  const write = process.argv.includes("--write");
  const onlyArg = process.argv[process.argv.indexOf("--only") + 1];
  const only = process.argv.includes("--only") ? onlyArg.split(",").map((s) => s.trim()) : null;

  const list = (candidates as Candidate[]).filter(
    (c) => !only || only.includes(c.title ?? c.src),
  );
  console.log(`후보 ${list.length}권 · ${write ? "**실제로 저장한다**" : "미리보기 (쓰려면 --write)"}\n`);

  const db = write
    ? createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
        auth: { persistSession: false },
      })
    : null;

  const all = candidates as Candidate[];
  let ok = 0;
  for (const c of list) {
    const title = c.title ?? c.src;
    const raw = await fetchPlainText(c.src);
    await sleep(SPACING_MS);
    if (!raw) {
      console.log(`✕ ${title} — 위키문헌에서 못 찾음 (${c.src})`);
      continue;
    }
    const text = clean(raw);
    if (text.length < 800) {
      console.log(`✕ ${title} — 본문이 없다 (${text.length}자). 스캔 전사 페이지이거나 목차만 있는 문서다`);
      continue;
    }
    const archaic = archaicHits(text);
    if (archaic >= 5) {
      console.log(`⚠ ${title} — 옛 표기 판본 (표지 ${archaic}개). 아이가 읽을 수 없어 넣지 않는다`);
      continue;
    }
    const chapters = toChapters(text);
    ok += 1;
    const gradeLabel = `${c.grade[0] <= 6 ? `초${c.grade[0]}` : `중${c.grade[0] - 6}`}~${c.grade[1] <= 6 ? `초${c.grade[1]}` : `중${c.grade[1] - 6}`}`;
    const slot = all.indexOf(c);
    console.log(
      `${String(slot + 1).padStart(2)}. ${title.padEnd(16)} ${c.author}  ${gradeLabel.padEnd(8)} ${chapters.length}장 ${Math.round(text.length / 1000)}k자  ${bookId(slot).slice(0, 8)}`,
    );
    for (const [ci, ch] of chapters.entries()) {
      console.log(`      ${ci + 1}장: ${ch.slice(0, 60).replace(/\n/g, " ")}…`);
    }

    if (db) {
      const id = bookId(slot);
      if (!(await slotIsFree(db, id, title))) continue;
      const { error: be } = await db.from("books").upsert({
        id,
        title,
        author: c.author,
        tags: c.tags,
        target_grade_min: c.grade[0],
        target_grade_max: c.grade[1],
        is_public_domain: true,
        curated: true,
      });
      if (be) {
        console.log(`      ✕ 책 저장 실패: ${be.message}`);
        continue;
      }
      await db.from("book_contents").delete().eq("book_id", id);
      const { error: ce } = await db.from("book_contents").insert(
        chapters.map((body, ci) => ({ book_id: id, chapter_no: ci + 1, title: `${ci + 1}장`, body })),
      );
      if (ce) {
        // 본문 없이 is_public_domain=true 로 남으면 "서재에 있어" 라고 표시되는데
        // 눌러도 못 읽는 책이 된다 (#116 리뷰, 이승환). 트랜잭션이 없으니 되돌린다.
        console.log(`      ✕ 본문 저장 실패: ${ce.message} — 책 행도 되돌린다`);
        const { error: re } = await db.from("books").delete().eq("id", id);
        if (re) {
          console.log(
            `      ✕✕ 되돌리기도 실패했다: ${re.message}. ${id} 를 손으로 지워야 한다`,
          );
        }
      }
    }
  }
  console.log(`\n가져온 책 ${ok}/${list.length}${write ? " · 저장 완료" : ""}`);
}

void main();
