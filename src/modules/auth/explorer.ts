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
  // 카피·이모지는 저학년 개편 목업 10 M01 (2026-09-20)
  { value: "새싹", emoji: "🌱", blurb: "이제 막 읽기 시작했어" },
  { value: "탐험가", emoji: "🧭", blurb: "혼자서도 한 권 다 읽어" },
  { value: "대장", emoji: "👑", blurb: "두꺼운 책도 끝까지" },
];
