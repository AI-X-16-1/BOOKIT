import {
  DeleteAccountButton,
  ExplorerRankSettings,
  SignOutButton,
} from "@/modules/auth";
import { GrowthSection } from "@/modules/growth";
import { LevelTestEntry } from "@/modules/level";
import { ItemShop, MeScreen } from "@/modules/rewards";

export default function Page() {
  return (
    <div className="flex flex-col gap-4">
      {/* 읽기 수준 진단 (spec §2c) — 이 화면의 **맨 위**다.
          시연 로그인(/auth/demo)은 온보딩을 건너뛰므로 이 줄이 유일한 진입로인데,
          아래에 뒀더니 430px 에서 여섯 섹션을 스크롤해야 나왔다 — 안 보이면 없는 기능이다.
          MeScreen(책갈피·읽은 책·교환·보호자·기록)만 해도 두 화면이라 그 뒤로는 늦다. */}
      <LevelTestEntry />
      <MeScreen />
      <GrowthSection />
      {/* 탐험가 등급 바꾸기 (#138 에서 export 됨, sprint-0918 ②).
          목업 7 #8 이 "등급은 나중에 프로필에서 바꿀 수 있어요" 라고 약속하는데
          그 자리가 여태 없었다 — 온보딩에서 한 번 고르면 되돌릴 길이 없었다 */}
      <ExplorerRankSettings />
      {/* 책갈피 상점 (④, spec §2b). 모은 책갈피가 어디로 가는지 보이는 자리 */}
      <ItemShop />
      <SignOutButton className="flex justify-center pt-2" />
      <DeleteAccountButton className="flex justify-center pb-6" />
    </div>
  );
}
