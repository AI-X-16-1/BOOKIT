/**
 * reader/server/text — 서재 책 본문을 AI 가 읽을 크기로 이어 붙인다. owner: 강민구
 *
 * 왜 있나 (#120): 채점·질문 프롬프트에 책 제목만 들어가서, 서재 책(모델이 줄거리를
 * 모르는 1920년대 단편)에 대해 책과 무관한 답이 통과했다 — 「눈 어두운 포수」의
 * 사냥꾼 포수를 야구 포수로 답해도 논리만 맞으면 pass. 우리에겐 본문이 있으니 넘긴다.
 *
 * 권한은 chapter.ts 와 같다 — RLS(book_contents_select_public_domain)가 저작권 있는
 * 책은 빈 결과로 돌려주므로 여기서는 null 이 된다. 코드에서 다시 거르지 않는다.
 */
import "server-only";

import type { BookitClient } from "@/shared/supabase";

/**
 * 프롬프트에 넣을 상한. 서재 29권 기준 중앙값 4,400자·최대 26,600자라 대부분 통째로
 * 들어가고, 긴 책만 앞에서 자른다. Sonnet 5 기준 12k 자 ≈ 8~10k 토큰, 채점 1회 $0.03 안팎.
 */
export const EXCERPT_MAX_CHARS = 12_000;

/**
 * 장 순서대로 이어 붙인 본문. 본문이 없거나(저작권 있는 책, 빈 서재 항목) 읽을 수 없으면 null.
 * 잘렸으면 끝에 표시를 남겨 모델이 "여기까지만 주어졌다"는 걸 알게 한다.
 */
export async function readBookText(
  supabase: BookitClient,
  bookId: string,
  maxChars: number = EXCERPT_MAX_CHARS,
): Promise<string | null> {
  const { data, error } = await supabase
    .from("book_contents")
    .select("chapter_no, title, body")
    .eq("book_id", bookId)
    .order("chapter_no", { ascending: true });

  if (error) {
    console.warn("[reader] 본문을 읽지 못해 제목만으로 진행한다", error);
    return null;
  }
  if (!data || data.length === 0) return null;

  const joined = data
    .map((chapter) =>
      chapter.title ? `[${chapter.chapter_no}. ${chapter.title}]\n${chapter.body}` : chapter.body,
    )
    .join("\n\n")
    .trim();

  if (!joined) return null;
  if (joined.length <= maxChars) return joined;
  return `${joined.slice(0, maxChars)}\n\n(…본문이 길어 여기까지만 주어졌다)`;
}
