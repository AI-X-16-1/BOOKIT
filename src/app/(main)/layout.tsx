import { TabBar } from "@/shared/ui";

/**
 * 학생용 화면 공통 레이아웃.
 *
 * 768px 미만: 하단 탭바.
 * 768px 이상: 좌측 아이콘 레일로 교체 (CLAUDE.md §8) — 레일은 아직 없다.
 * 레일을 붙일 때 TabBar 의 NAV_ITEMS 를 그대로 재사용할 것.
 */
export default function MainLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="flex min-h-full flex-col">
      <main className="flex-1 px-[22px] pt-[52px] pb-[86px] md:pb-0">
        {children}
      </main>
      <TabBar />
    </div>
  );
}
