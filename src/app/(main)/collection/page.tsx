import { redirect } from "next/navigation";

import { CollectionScreen } from "@/modules/verification";
import { loadCollection } from "@/modules/verification/server";
import { createServerSupabase } from "@/shared/supabase/server";

/** 세션을 읽으므로 빌드 시 프리렌더 대상이 아니다 */
export const dynamic = "force-dynamic";

/**
 * /collection — 도감 (docs/sprint-0918.md ②, 목업 7 #5).
 *
 * 칸이 수십 개라 한 번에 서버에서 읽어 넘긴다 — 화면이 열리자마자 다 보여야 하고,
 * 칩으로 거르는 것은 이미 받아 둔 목록 안에서 한다.
 */
export default async function CollectionPage() {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const collection = await loadCollection(supabase, user.id);

  return (
    <CollectionScreen
      entries={collection.entries}
      captured={collection.captured}
      total={collection.total}
      tags={collection.tags}
    />
  );
}
