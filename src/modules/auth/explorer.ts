/**
 * 탐험가 등급 — 온보딩에서 학생이 고르는 자기 선언 (docs/spec.md §2b, 0014).
 *
 * 소유: 김민경 (CLAUDE.md §3).
 *
 * 화면 톤(인사말·캐릭터 말투)에만 쓴다. 학년(grade_level)은 AI 난이도에 쓰이므로
 * 그대로다 — 등급이 학년을 대체하지 않는다. 고르지 않아도 된다 (null).
 */

import type { ExplorerRank } from "@/shared/types";

export const EXPLORER_RANKS: Array<{
  value: ExplorerRank;
  emoji: string;
  blurb: string;
}> = [
  { value: "새싹", emoji: "🌱", blurb: "책 읽기 시작했어" },
  { value: "탐험가", emoji: "🧭", blurb: "책을 꽤 읽어봤어" },
  { value: "대장", emoji: "🏔", blurb: "책이라면 자신 있어" },
];
