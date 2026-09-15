/**
 * 단어 사전 실호출 검증 — `npm run reader:dict`
 *
 * 국립국어원 API 는 무료(하루 5만 건)라 마음껏 돌려도 된다.
 * 보는 것은 네 가지다.
 *   1. 동음이의어·이웃 표제어에서 엉뚱한 단어의 뜻이 붙지 않는가
 *   2. 조사·어미가 붙은 채로 눌러도 원형을 찾는가
 *   3. 본문에서 쓰인 뜻이 보여주는 뜻 목록(senses) 안에 들어 있는가 (#43)
 *   4. 사전에 없는 말(고유명사 등)을 not_found 로 깔끔히 처리하는가
 */
import { DictError, lookup } from "@/modules/reader/server/dict";

/**
 * [아이가 누른 낱말, 떠야 하는 표제어 (null 이면 not_found 가 정상),
 *  senses 중 하나에 들어 있어야 하는 말 — 본문에서 쓰인 뜻]
 */
const CASES: Array<[string, string | null, string?]> = [
  ["나무", "나무", "불을 때기"], // 운수 좋은 날 "나무 한 단" — 3번 뜻
  ["제비", "제비"],
  ["심술", "심술"],
  ["겨루다", "겨루다"],
  ["처마", "처마"],
  // 조사가 붙은 경우
  ["제비가", "제비"],
  ["다리를", "다리"],
  ["그늘에서", "그늘"],
  ["첨지에게는", null], // 조사 두 겹을 떼도 기초사전에 '첨지' 가 없다
  // 한 글자 체언 + 조사
  ["비가", "비"],
  ["눈은", "눈", "얼음 조각"], // 운수 좋은 날 "눈은 아니 오고" — 눈⁴
  ["돈이", "돈"],
  ["산에", "산"],
  ["일입니다", "일"],
  ["나를", "나"], // API 안내는 '나르다' 를 가리킨다 — 대명사가 먼저
  // 활용 안내 항목 ("오-" 는 뜻이 아니다)
  ["오고", "오다"],
  ["이어질", "이어지다"],
  ["쓰입니다", "쓰이다", "이용되다"], // 쓰이다³
  ["흐린", "흐리다", "날씨"], // 운수 좋은 날 "새침하게 흐린 품이" — 5번 뜻
  // 어미를 직접 떼야 하는 경우
  ["되었다", "되다"],
  ["만났습니다", "만나다"],
  ["새침하게", "새침하다"],
  ["기절해", "기절하다"],
  ["가깝게", "가깝다"],
  ["있었던", "있다"],
  ["있을까", "있다"],
  ["없었는지", "없다"],
  ["만나거든", "만나다"],
  // 사전에 없어야 정상
  ["잎싹", null], // 고유명사
  ["ㅁㄴㅇㄹ", null], // 쓰레기 입력
  ["", null], // 빈 입력
];

async function main() {
  let failed = 0;

  for (const [word, expected, mustInclude] of CASES) {
    const label = (word || "(빈 문자열)").padEnd(8);
    const startedAt = Date.now();

    try {
      const result = await lookup(word);
      const ms = String(Date.now() - startedAt).padStart(5);
      const wordOk = result.word === expected;
      const senseOk =
        !mustInclude || result.senses.some((sense) => sense.definition.includes(mustInclude));
      const ok = wordOk && senseOk && result.definition === result.senses[0]?.definition;
      if (!ok) failed++;

      console.log(
        `${ok ? "✓" : "✕"} ${label} ${ms}ms  [${result.word}] 뜻 ${result.senses.length}개 · ` +
          `${result.definition.slice(0, 32)}` +
          (wordOk ? "" : `   ← 기대 표제어: ${expected ?? "not_found"}`) +
          (senseOk ? "" : `   ← 뜻 목록에 '${mustInclude}' 없음`),
      );
    } catch (error) {
      if (!(error instanceof DictError)) throw error;
      const ms = String(Date.now() - startedAt).padStart(5);
      const ok = expected === null && error.kind === "not_found";
      if (!ok) failed++;

      console.log(
        `${ok ? "✓" : "✕"} ${label} ${ms}ms  [${error.kind}] ${error.message}` +
          (ok ? "" : `   ← 기대: ${expected}`),
      );
    }
  }

  console.log(`\n${CASES.length - failed}/${CASES.length} 통과`);
  if (failed) process.exitCode = 1;
}

main().catch((error: unknown) => {
  console.error(`\n✕ ${error instanceof Error ? error.stack : String(error)}`);
  process.exitCode = 1;
});
