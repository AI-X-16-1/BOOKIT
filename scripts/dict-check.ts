/**
 * 단어 사전 실호출 검증 — `npm run reader:dict`
 *
 * 국립국어원 API 는 무료(하루 5만 건)라 마음껏 돌려도 된다.
 * 보는 것은 두 가지다.
 *   1. 동음이의어·활용형에서 엉뚱한 단어의 뜻이 붙지 않는가
 *   2. 사전에 없는 말(고유명사 등)을 not_found 로 깔끔히 처리하는가
 */
import { DictError, lookup } from "@/modules/reader/server/dict";

/** 책잇 서재 본문에서 아이가 누를 법한 말들 + 함정 케이스 */
const WORDS = [
  "나무", // 뜻 3개 + '나무라다' 같은 이웃 표제어가 섞여 오는 대표 함정
  "제비",
  "심술", // 흥부와 놀부 본문
  "겨루다", // 토끼와 거북이 본문
  "처마",
  "정성껏",
  "잎싹", // 고유명사 — 없어야 정상
  "ㅁㄴㅇㄹ", // 쓰레기 입력 — not_found 로 떨어져야 한다
  "", // 빈 입력
];

async function main() {
  for (const word of WORDS) {
    const label = word || "(빈 문자열)";
    const startedAt = Date.now();

    try {
      const result = await lookup(word);
      const ms = Date.now() - startedAt;
      const exact = result.word === word;
      console.log(
        `${exact ? "✓" : "✕"} ${label.padEnd(10)} ${String(ms).padStart(5)}ms  ` +
          `[${result.word}] ${result.definition.slice(0, 52)}`,
      );
      if (!exact) {
        console.log(`     ⚠ 검색어와 표제어가 다르다 — 엉뚱한 뜻일 수 있다`);
      }
    } catch (error) {
      const ms = Date.now() - startedAt;
      if (error instanceof DictError) {
        const expected = error.kind === "not_found";
        console.log(
          `${expected ? "✓" : "✕"} ${label.padEnd(10)} ${String(ms).padStart(5)}ms  ` +
            `[${error.kind}] ${error.message}`,
        );
        continue;
      }
      throw error;
    }
  }
}

main().catch((error: unknown) => {
  console.error(`\n✕ ${error instanceof Error ? error.stack : String(error)}`);
  process.exitCode = 1;
});
