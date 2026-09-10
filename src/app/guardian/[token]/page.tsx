import { GuardianView } from "@/modules/guardian";

/**
 * 보호자 공유 링크. 인증 없음 (docs/spec.md §5).
 * 탭바·레일이 없는 독립 화면이라 (main) 그룹 밖에 둔다.
 */
export default async function Page({ params }: PageProps<"/guardian/[token]">) {
  const { token } = await params;
  return <GuardianView token={token} />;
}
