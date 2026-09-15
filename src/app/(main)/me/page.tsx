import { SignOutButton } from "@/modules/auth";
import { GrowthSection } from "@/modules/growth";
import { MeScreen } from "@/modules/rewards";

export default function Page() {
  return (
    <div className="flex flex-col gap-4">
      <MeScreen />
      <GrowthSection />
      <SignOutButton className="flex justify-center pt-2 pb-6" />
    </div>
  );
}
