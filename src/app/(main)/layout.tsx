import { SideRail, TabBar } from "@/shared/ui";

/**
 * 학생용 화면 공통 레이아웃.
 *
 * 768px 미만: 하단 탭바.
 * 768px 이상: 좌측 아이콘 레일 (CLAUDE.md §8). 둘 다 NAV_ITEMS 를 공유한다.
 */
export default function MainLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="flex min-h-dvh">
      <SideRail />
      <main className="min-w-0 flex-1 px-[22px] pt-[52px] pb-[86px] md:pt-8 md:pb-8">
        {children}
      </main>
      <TabBar />
    </div>
  );
}
