import { redirect } from "next/navigation";

import { LibraryScreen } from "@/modules/reader";
import { listShelf, readMyGrade } from "@/modules/reader/server";
import { createServerSupabase } from "@/shared/supabase/server";

/** 세션을 읽으므로 빌드 시 프리렌더 대상이 아니다 */
export const dynamic = "force-dynamic";

/**
 * /library                        — 책잇 서재. 책 목록은 여기서 읽고, 본문은 화면이 장마다 불러온다.
 * /library?book=<id>&chapter=<n>  — 그 책의 그 장을 바로 펼친다 (reader 의 libraryHref).
 */
export default async function LibraryPage({ searchParams }: PageProps<"/library">) {
  const { book, chapter } = await searchParams;

  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const chapterNo = typeof chapter === "string" ? Number.parseInt(chapter, 10) : 1;

  return (
    <LibraryScreen
      books={await listShelf(supabase)}
      myGrade={await readMyGrade(supabase, user.id)}
      initial={
        typeof book === "string"
          ? { bookId: book, chapterNo: Number.isFinite(chapterNo) ? chapterNo : 1 }
          : undefined
      }
    />
  );
}
