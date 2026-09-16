/**
 * 장르 태그 재태깅 배치 — `npm run ai:retag`. owner: 강민구
 *
 *   npm run ai:retag                 무엇이 바뀔지만 보여준다 (기본: 쓰기 없음)
 *   npm run ai:retag -- --write      실제로 books.tags 를 채운다
 *   npm run ai:retag -- --limit 5    앞에서 N 권만
 *
 * 왜 배치인가 (2026-09-16 실측):
 *   검색 결과의 분류는 NLK SEOJI 의 SUBJECT — KDC 대분류 한 자리 숫자다. 대분류로는
 *   역사·예술·과학·인물심리 같은 비문학만 확실히 잡힌다 (modules/ai/kdc.ts).
 *   정작 이 서비스가 다루는 문학(전체의 29%)은 동화·성장소설·판타지·추리가 전부 KDC 8 이라
 *   숫자로 못 가른다. nl.go.kr 의 전체 분류기호(classNo)도 안 된다 —
 *   「마당을 나온 암탉」(동화)과 「아몬드」(청소년 소설)가 똑같이 813.7 이다.
 *
 *   그래서 문학 장르는 AI(#5, normalizeGenreTags)가 맡는다. 검색 경로에서 부르면 결과
 *   10건마다 LLM 을 10번 부르게 되므로(search.ts 의 upsertHit), 저장된 뒤 배치로 돌린다.
 *   도장판과 추천은 어차피 DB 만 읽는다.
 *
 * 안전장치: 이미 태그가 있는 행은 건드리지 않는다. --write 없이는 아무것도 쓰지 않는다.
 */
import { createAdminClient } from "@/shared/supabase/admin";

import { LlmError, normalizeGenreTags } from "@/modules/ai";

/** 무료 티어 분당 한도 대응. 다른 ai 스크립트와 같은 값이다. */
const SPACING_MS = 15_000;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? undefined : process.argv[i + 1];
}

async function main() {
  const write = process.argv.includes("--write");
  const limit = Number(arg("limit") ?? "0");

  const supabase = createAdminClient();
  const { data: books, error } = await supabase
    .from("books")
    .select("id, title, author, tags")
    .order("title");
  if (error) throw new Error("books 를 읽지 못했다.", { cause: error });

  const targets = books
    .filter((book) => (book.tags ?? []).length === 0)
    .slice(0, limit > 0 ? limit : undefined);

  console.log(
    `books ${books.length}권 중 태그가 없는 책 ${books.filter((b) => (b.tags ?? []).length === 0).length}권` +
      (limit > 0 ? ` (이번 실행은 ${targets.length}권)` : ""),
  );
  if (targets.length === 0) return;
  if (!write) console.log("※ 미리보기다. 실제로 쓰려면 --write 를 붙인다.\n");

  let tagged = 0;
  let empty = 0;

  for (const [index, book] of targets.entries()) {
    process.stdout.write(`${String(index + 1).padStart(3)} ${book.title.slice(0, 24).padEnd(26)}`);

    let tags: string[];
    try {
      ({ tags } = await normalizeGenreTags({
        title: book.title,
        author: book.author ?? undefined,
      }));
    } catch (err) {
      console.log(err instanceof LlmError ? `✕ [${err.kind}] ${err.message}` : `✕ ${String(err)}`);
      continue;
    }

    if (tags.length === 0) {
      empty += 1;
      console.log("— 맞는 태그 없음 (그대로 둔다)");
    } else {
      tagged += 1;
      console.log(`→ ${tags.join(", ")}`);
      if (write) {
        const { error: updateError } = await supabase
          .from("books")
          .update({ tags })
          .eq("id", book.id);
        if (updateError) console.log(`    ✕ 저장 실패: ${updateError.message}`);
      }
    }

    if (index < targets.length - 1) await sleep(SPACING_MS);
  }

  console.log(
    `\n태그를 받은 책 ${tagged}권 · 맞는 태그가 없던 책 ${empty}권` +
      (write ? " · books.tags 에 저장했다." : " · 아무것도 쓰지 않았다 (--write 없음)."),
  );
}

main().catch((error: unknown) => {
  console.error(`\n✕ ${error instanceof Error ? (error.stack ?? error.message) : String(error)}`);
  process.exitCode = 1;
});
