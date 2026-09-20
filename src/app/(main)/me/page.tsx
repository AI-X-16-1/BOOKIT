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
    <div className="flex flex-col gap-3.5">
      {/* 저학년 개편(목업 10 M09) 순서: 프로필·책갈피·이번 주 → 꾸미기 → 책나무·도장판 → 설정(읽기 수준·등급) → 나가기.
          읽기 수준 진단은 시연 계정의 유일한 진입로라 화면 안에 남긴다 — 다만 맨 위 대신 설정 묶음으로 (#184 2번) */}
      <MeScreen />
      <ItemShop />
      <GrowthSection />
      <LevelTestEntry />
      <ExplorerRankSettings />
      <SignOutButton className="flex justify-center pt-2" />
      <DeleteAccountButton className="flex justify-center pb-6" />
    </div>
  );
}
