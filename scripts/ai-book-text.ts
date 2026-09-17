/**
 * 책 본문을 넘겼을 때 채점이 책과 무관한 답을 거르는지 — `npm run ai:book-text`
 *
 * 배경 (#120): 서재 책은 모델이 줄거리를 모르는 1920년대 단편이라, 제목만 주면
 * 「눈 어두운 포수」의 사냥꾼 포수를 야구 포수로 답해도 논리만 맞으면 통과했다.
 *
 * 운영 DB 의 실제 본문으로 세 가지를 돈다 (실호출, 비용 발생):
 *   A. 본문 없이 — 야구 포수 답변 (종전 동작 확인용. pass 가 나와도 실패로 치지 않는다)
 *   B. 본문 있이 — 야구 포수 답변 → logic_consistency 가 fail 이어야 한다
 *   C. 본문 있이 — 책을 읽은 답변 → 통과해야 한다 (본문을 넣었다고 엄격해지면 안 된다)
 *      BOOK_TEXT_ANSWER 환경변수로 준다. 없으면 기본 답변을 쓴다.
 *
 * .env.local 에 LLM_API_KEY 와 SUPABASE_SERVICE_ROLE_KEY 가 있어야 한다.
 */
import { createClient } from "@supabase/supabase-js";

import { buildQuestion, grade, readThreshold } from "@/modules/ai";
import type { BookContext, Gap } from "@/shared/types";

const TITLE = "눈 어두운 포수";
const GRADE = 5 as const;

const REVIEW = "눈이 많이 어두운것같다 야맹증에는 비타민 B가 좋다는데 좀 먹어야할듯?";
const GAP: Gap = {
  quote: "눈이 많이 어두운것같다",
  type: "unsupported_claim",
  reason: "포수가 눈이 어둡다고 했는데 책의 어떤 장면에서 그렇게 봤는지 없어.",
};
const QUESTION = "책의 어느 부분 때문에 포수가 눈이 어둡다고 느꼈어?";

/** 책에 없는 내용 — 야구 포수 */
const OFF_BOOK_ANSWER =
  "포수가 공을 자꾸 놓치는 장면이 있었어. 투수가 던진 공이 잘 안 보여서 뒤로 빠뜨렸어.";

/** 책을 읽은 아이의 답. 세부는 조금 흐려도 된다 — 그래도 통과해야 한다 */
const DEFAULT_ON_BOOK_ANSWER =
  "포수가 눈이 어두워서 사냥을 잘 못하다가 사슴 발자국을 보고 덫을 놓았어. 밤에 사슴이 덫에 걸렸는데 포수는 눈이 안 좋아서 잘 못 보고 헤맸어.";

function requireEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} 이 .env.local 에 없다`);
  return value;
}

async function main() {
  const db = createClient(
    requireEnv("NEXT_PUBLIC_SUPABASE_URL"),
    requireEnv("SUPABASE_SERVICE_ROLE_KEY"),
    { auth: { persistSession: false } },
  );

  const { data: book } = await db
    .from("books")
    .select("id, title, author, tags")
    .eq("title", TITLE)
    .eq("is_public_domain", true)
    .maybeSingle();
  if (!book) throw new Error(`서재에 「${TITLE}」 가 없다`);

  const { data: chapters } = await db
    .from("book_contents")
    .select("chapter_no, title, body")
    .eq("book_id", book.id)
    .order("chapter_no", { ascending: true });
  const excerpt = (chapters ?? [])
    .map((c) => (c.title ? `[${c.chapter_no}. ${c.title}]\n${c.body}` : c.body))
    .join("\n\n");
  if (!excerpt) throw new Error("본문이 비어 있다");

  const ctx: BookContext = { title: book.title, author: book.author, tags: book.tags };
  console.log(`model: ${process.env.LLM_MODEL} / threshold: ${readThreshold()}`);
  console.log(`book: ${book.title} (${excerpt.length}자)\n`);

  const a = await grade(REVIEW, GAP, QUESTION, OFF_BOOK_ANSWER, ctx, { gradeLevel: GRADE });
  console.log(`A. 본문 없음 · 야구 포수 → logic=${a.logic_consistency} spec=${a.specificity} passed=${a.passed}`);
  console.log(`   ${a.feedback}`);

  const b = await grade(REVIEW, GAP, QUESTION, OFF_BOOK_ANSWER, ctx, { gradeLevel: GRADE, excerpt });
  console.log(`B. 본문 있음 · 야구 포수 → logic=${b.logic_consistency} spec=${b.specificity} passed=${b.passed}`);
  console.log(`   ${b.feedback}`);

  const onBookAnswer = process.env.BOOK_TEXT_ANSWER?.trim() || DEFAULT_ON_BOOK_ANSWER;
  const c = await grade(REVIEW, GAP, QUESTION, onBookAnswer, ctx, { gradeLevel: GRADE, excerpt });
  console.log(`C. 본문 있음 · 읽은 답변 → logic=${c.logic_consistency} spec=${c.specificity} passed=${c.passed}`);
  console.log(`   ${c.feedback}`);

  // 질문은 본문 없이 만든다 — 본문을 주면 장면을 보기로 나열하는 힌트 질문이 됐다 (prompts.ts 주석)
  const q = await buildQuestion(GAP, REVIEW, ctx, { gradeLevel: GRADE });
  console.log(`\n질문 (본문 없이): ${q.question}`);

  let failed = false;
  if (b.logic_consistency !== "fail") {
    console.log("\n✕ B 가 fail 이 아니다 — 본문을 넣어도 책과 무관한 답을 못 거른다");
    failed = true;
  }
  if (!c.passed) {
    console.log("\n✕ C 가 통과하지 못했다 — 본문을 넣었더니 읽은 답도 떨어뜨린다");
    failed = true;
  }
  if (!failed) console.log("\n✓ B fail · C pass — 본문이 있으면 책과 무관한 답만 거른다");
  process.exitCode = failed ? 1 : 0;
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
