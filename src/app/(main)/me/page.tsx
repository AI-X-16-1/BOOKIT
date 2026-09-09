import { MeScreen } from "@/modules/rewards";
import { GrowthSection } from "@/modules/growth";

export default function Page() {
  return (
    <div className="flex flex-col gap-4">
      <MeScreen />
      <GrowthSection />
    </div>
  );
}
