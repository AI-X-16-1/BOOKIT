import {
  DeleteAccountButton,
  ExplorerRankSettings,
  SignOutButton,
} from "@/modules/auth";
import { GrowthSection } from "@/modules/growth";
import { MeScreen } from "@/modules/rewards";

export default function Page() {
  return (
    <div className="flex flex-col gap-4">
      <MeScreen />
      <GrowthSection />
      {/* 탐험가 등급 바꾸기 (#138 에서 export 됨, sprint-0918 ②).
          목업 7 #8 이 "등급은 나중에 프로필에서 바꿀 수 있어요" 라고 약속하는데
          그 자리가 여태 없었다 — 온보딩에서 한 번 고르면 되돌릴 길이 없었다 */}
      <ExplorerRankSettings />
      {/* 탐험가 등급 바꾸기 (#138 에서 export 됨, sprint-0918 ②).
          목업 7 #8 이 "등급은 나중에 프로필에서 바꿀 수 있어요" 라고 약속하는데
          그 자리가 여태 없었다 — 온보딩에서 한 번 고르면 되돌릴 길이 없었다 */}
      <ExplorerRankSettings />
      <SignOutButton className="flex justify-center pt-2" />
      <DeleteAccountButton className="flex justify-center pb-6" />
    </div>
  );
}
