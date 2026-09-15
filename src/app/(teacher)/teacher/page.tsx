import { DeleteAccountButton, SignOutButton } from "@/modules/auth";
import { TeacherDashboard } from "@/modules/teacher";

export default function Page() {
  return (
    <TeacherDashboard
      actions={
        <>
          <SignOutButton />
          <DeleteAccountButton warning="반과 참여 코드도 함께 지워져. 학생들은 반을 다시 찾아야 해." />
        </>
      }
    />
  );
}
