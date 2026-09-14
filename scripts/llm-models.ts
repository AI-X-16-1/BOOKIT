/**
 * 발급받은 키로 실제 쓸 수 있는 모델 목록 — `npm run llm:models`
 *
 * LLM_MODEL 에 뭘 넣어야 하는지 추측하지 않기 위한 스크립트다.
 * 벤더가 모델 이름을 자주 바꾸므로 문서보다 이쪽이 정확하다.
 */
import { LlmError, readConfig } from "@/modules/ai/server/llm";
import { listModels } from "@/modules/ai/server/providers";

async function main() {
  const { provider, apiKey, model } = readConfigLenient();
  console.log(`provider: ${provider}`);
  console.log(`현재 LLM_MODEL: ${model || "(비어 있음)"}\n`);

  const names = await listModels(provider, apiKey);
  console.log(`쓸 수 있는 모델 ${names.length}개:`);
  for (const name of names) {
    console.log(`  ${name === model ? "→" : " "} ${name}`);
  }

  if (model && !names.includes(model)) {
    console.log(`\n⚠ LLM_MODEL=${model} 은 이 목록에 없다. 위에서 골라 바꿔라.`);
  }
}

/** LLM_MODEL 이 아직 안 정해졌어도 목록은 볼 수 있어야 한다. */
function readConfigLenient() {
  const model = process.env.LLM_MODEL?.trim() ?? "";
  if (!model) process.env.LLM_MODEL = "__unset__";
  const config = readConfig();
  return { ...config, model };
}

main().catch((error: unknown) => {
  if (error instanceof LlmError) {
    console.error(`\n✕ [${error.kind}] ${error.message}`);
    process.exitCode = 1;
    return;
  }
  console.error(`\n✕ ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
