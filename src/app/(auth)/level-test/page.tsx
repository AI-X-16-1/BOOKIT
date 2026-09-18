import { redirect } from "next/navigation";

import { LevelTestScreen } from "@/modules/level";
import { createServerSupabase } from "@/shared/supabase/server";

/** 세션을 읽으므로 빌드 시 프리렌더 대상이 아니다 */
export const dynamic = "force-dynamic";

/**
 * /level-test — 읽기 수준 진단.
 *
 * ⚠️ **제출 범위 밖** (modules/level/index.ts 머리말). 어디에서도 링크하지 않는다 —
 * 주소를 아는 사람만 들어온다. 온보딩 흐름에 끼우는 것은 제출 뒤에, auth 소유자와
 * 함께 한다 (온보딩 화면은 김민경 소관, CLAUDE.md §3).
 *
 * (auth) 그룹에 두는 이유는 탭바·레일이 없어야 하기 때문이다. 진단 중에 다른 탭으로
 * 새면 지문을 읽다 만 채로 상태가 사라진다 — 서버에 저장하지 않으므로 복구가 없다.
 */
export default async function LevelTestPage() {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  return (
    <main className="mx-auto min-h-dvh w-full max-w-[520px] px-[22px] pt-[52px] pb-10">
      <LevelTestScreen />
    </main>
  );
}
