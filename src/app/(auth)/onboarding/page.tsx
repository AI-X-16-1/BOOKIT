import { redirect } from "next/navigation";

import { OnboardingScreen } from "@/modules/auth";
import { createServerSupabase } from "@/shared/supabase/server";

/** 세션을 읽으므로 빌드 시 프리렌더 대상이 아니다 */
export const dynamic = "force-dynamic";

/** 구글 이름을 서버에서 읽어 화면에 넘긴다. 미들웨어가 이미 미로그인을 걸러낸다 */
export default async function Page() {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name")
    .eq("id", user.id)
    .maybeSingle();

  return <OnboardingScreen displayName={profile?.display_name ?? "친구"} />;
}
