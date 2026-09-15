import { redirect } from "next/navigation";

import { LibraryScreen } from "@/modules/reader";
import { listShelf } from "@/modules/reader/server";
import { createServerSupabase } from "@/shared/supabase/server";

/** 세션을 읽으므로 빌드 시 프리렌더 대상이 아니다 */
export const dynamic = "force-dynamic";

/** /library — 책잇 서재. 책 목록은 여기서 읽고, 본문은 화면이 장마다 불러온다. */
export default async function LibraryPage() {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  return <LibraryScreen books={await listShelf(supabase)} />;
}
