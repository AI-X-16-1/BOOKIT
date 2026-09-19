/**
 * reader/partner — 책을 읽을 때 옆에 나오는 **내 파트너**. owner: 강민구
 *
 * 9/19 강민구 결정: 읽는 중에는 보스(그 책)와 싸우는 이야기가 하나도 없어 끝의 보스전과
 * 따로 놀았다. 그래서 내 캐릭터 하나가 파트너로 같이 읽고, 낱말 퀴즈를 맞히면 보스를
 * 공격한다. 보스전 화면·채점·책갈피는 그대로다 — 연출뿐이다 (spec §2b 불변).
 *
 * 파트너 = 가진 캐릭터 중 가장 많이 자란 것 (최종 > 부화 > 알), 같으면 가장 최근에 얻은 것.
 * 하나도 없으면 null — 화면은 "이 책의 알" 을 대신 세운다.
 *
 * 얼굴은 도감(verification/CollectionScreen)과 **같은 규칙**이다: 최종 진화는 art_seed 로
 * 고른 동물, 부화는 🐣, 알은 🥚. 도감과 다르면 아이가 같은 캐릭터를 못 알아본다 —
 * 도감 쪽 FACES·seedNumber 를 바꾸면 여기도 같이 바꾼다.
 */
import type { CharacterView } from "@/shared/types";

/** 도감의 FACES 와 같은 목록·같은 순서 */
const FACES = ["🐉", "🦊", "🐢", "🦉", "🐯", "🐰", "🐻", "🦋"];

/** 도감의 seedNumber 와 같은 식 */
function seedNumber(seed: string): number {
  let n = 0;
  for (const ch of seed) n = (n * 31 + ch.charCodeAt(0)) % 100000;
  return n;
}

export interface Partner {
  face: string;
  /** 지금 단계의 이름 (stage_names[stage]) */
  name: string;
  stage: 0 | 1 | 2;
}

export function faceOf(stage: 0 | 1 | 2, artSeed: string, bookId: string): string {
  if (stage === 0) return "🥚";
  if (stage === 1) return "🐣";
  return FACES[seedNumber(artSeed || bookId) % FACES.length];
}

export function pickPartner(characters: CharacterView[]): Partner | null {
  const best = [...characters].sort(
    (a, b) => b.stage - a.stage || b.obtained_at.localeCompare(a.obtained_at),
  )[0];
  if (!best) return null;
  const stage = best.stage as 0 | 1 | 2;
  return { face: faceOf(stage, best.art_seed, best.book_id), name: best.stage_name, stage };
}
