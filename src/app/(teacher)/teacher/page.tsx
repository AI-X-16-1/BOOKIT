import { SignOutButton } from "@/modules/auth";
import { TeacherDashboard } from "@/modules/teacher";

export default function Page() {
  return <TeacherDashboard actions={<SignOutButton />} />;
}
