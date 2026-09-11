import { redirect } from "next/navigation";

import { PickBookFirst, WriteFlow } from "@/modules/review";
import { loadWriteSession } from "@/modules/review/server";
import { createServerSupabase } from "@/shared/supabase/server";

/**
 * /write?book=<id> — 그 책으로 쓰던 독후감을 연다. 없으면 새로 쓴다.
 * /write           — 가장 최근에 쓰던 독후감을 연다 (홈의 "이어서 쓰기").
 */
export default async function WritePage({ searchParams }: PageProps<"/write">) {
  const { book } = await searchParams;

  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const session = await loadWriteSession(
    supabase,
    user.id,
    typeof book === "string" ? book : undefined,
  );
  if (!session) return <PickBookFirst />;

  // 다른 책으로 옮겨 가면 작성 상태를 통째로 새로 시작한다
  return <WriteFlow key={session.book.id} {...session} />;
}
