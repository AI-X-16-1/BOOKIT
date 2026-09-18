/**
 * 책 표지 퍼즐. 목업 7 #4 (docs/mockups/7 보스전·성장 개편 (모바일).dc.html).
 *
 * 9/18 마감 스프린트(docs/sprint-0918.md) ① — 장을 읽을수록 표지가 드러난다.
 *
 * 조각 = 읽은 장 (docs/spec.md §2b). 조각 수는 그 책의 장 수라서 3×3 으로 고정하지
 * 않는다 — 목업의 9조각은 9장인 책의 모습이다. 열 수는 3 으로 두고 줄 수만 늘린다.
 *
 * 그리는 방법: 표지(또는 자리표시자 그라데이션)를 **컨테이너 한 장**에 깔고,
 * 아직 안 읽은 장만 불투명한 타일로 덮는다. 조각마다 표지를 잘라 붙이지 않아서
 * 장 수가 몇이든 그림이 이어지고, 열린 조각은 실제 표지의 그 부분이 보인다.
 *
 * 순수 표시용이다 — 데이터는 받아서 그리기만 하고 읽기 기록을 쓰지 않는다
 * (그건 reader 의 POST /api/reading/progress, spec §5b).
 */
import { cn } from "@/shared/ui";

const COLUMNS = 3;

/**
 * `url("…")` 안에 넣어도 안전한 문자열로.
 *
 * 표지 URL 은 외부 API 에서 온 값이라 따옴표·역슬래시가 섞이면 선언을 빠져나가
 * 옆의 CSS 를 덮어쓸 수 있다. CSS.escape 는 브라우저에만 있어서 (이 컴포넌트는
 * 서버에서도 그려진다) 쓰지 않는다.
 */
function cssUrl(url: string): string {
  return url.replace(/["'\\\s)]/g, encodeURIComponent);
}

export interface CoverPuzzleProps {
  /** 알라딘 표지 URL. 없으면 초록 자리표시자 (CLAUDE.md §10) */
  coverUrl: string | null;
  readChapters: number;
  totalChapters: number;
  className?: string;
}

export function CoverPuzzle({
  coverUrl,
  readChapters,
  totalChapters,
  className,
}: CoverPuzzleProps) {
  // 장이 없는 책(서재 밖)은 퍼즐이 없다. 0 으로 나누는 것도 여기서 막힌다
  if (totalChapters <= 0) return null;

  const opened = Math.min(Math.max(readChapters, 0), totalChapters);
  const left = totalChapters - opened;
  const percent = Math.round((opened / totalChapters) * 100);
  const rows = Math.ceil(totalChapters / COLUMNS);

  return (
    <div className={cn("rounded-card border border-border-soft bg-card p-[18px]", className)}>
      <div
        className={cn(
          "grid gap-1.5 overflow-hidden rounded-md bg-cover bg-center",
          !coverUrl && "bg-linear-160 from-green-light to-green",
        )}
        style={{
          gridTemplateColumns: `repeat(${COLUMNS}, 1fr)`,
          aspectRatio: `${COLUMNS * 3} / ${rows * 4}`,
          backgroundImage: coverUrl ? `url("${cssUrl(coverUrl)}")` : undefined,
        }}
        role="img"
        aria-label={`표지 조각 ${totalChapters}개 중 ${opened}개 열림`}
      >
        {Array.from({ length: totalChapters }, (_, i) => (
          <div
            key={i}
            // 열린 조각은 아래 표지가 그대로 보이게 비워 둔다
            className={
              i < opened
                ? ""
                : "flex items-center justify-center bg-rule text-lg text-on-dark-2"
            }
            aria-hidden
          >
            {i < opened ? null : "🔒"}
          </div>
        ))}
      </div>

      <div className="mt-4 h-2.5 overflow-hidden rounded-full bg-border-soft">
        <div
          className="h-2.5 rounded-full bg-green transition-[width] duration-500"
          style={{ width: `${percent}%` }}
        />
      </div>
      <div className="mt-2.5 flex items-center justify-between gap-3">
        <span className="text-[13px] text-ink-warm">{percent}% 열림</span>
        <span className="flex-none text-[13px] font-bold text-coral-deep">
          {left === 0 ? "다 열었어!" : `${left}조각 남음`}
        </span>
      </div>
    </div>
  );
}
