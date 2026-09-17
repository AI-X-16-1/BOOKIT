/**
 * ai/server/llm — LLM 호출의 단일 창구. owner: 강민구
 *
 * 프롬프트 4종(docs/prompts.md)이 전부 이 파일의 callJson 위에 올라간다.
 * 여기가 흔들리면 검증 플로우 전체가 흔들린다.
 *
 * 규칙 (CLAUDE.md §1):
 * - 클라이언트에서 절대 호출하지 않는다. `server-only` 가 빌드 타임에 막는다.
 * - API 키는 서버 환경변수에만 둔다. NEXT_PUBLIC_ 접두사를 붙이지 않는다.
 *
 * 벤더 차이는 providers.ts 가 흡수한다. 이 파일은 검증·복구·재질문만 본다.
 * 프로덕션은 LLM_PROVIDER 하나로 고정한다 (plan-ko.md §5-2).
 * 모델 문자열은 LLM_MODEL 로 뺐다 — 제출 서류에 들어가는 값이라 코드에 박지 않는다.
 */
import "server-only";

import type { z } from "zod";

import {
  call,
  ProviderCallError,
  THINKING_LEVELS,
  type Effort,
  type Provider,
  type ThinkingLevelName,
} from "./providers";

export type { Effort, Provider, ThinkingLevelName };

/** 형식이 어긋났을 때 다시 물어보는 횟수 포함 총 시도 횟수. */
const MAX_ATTEMPTS = 2;

const PROVIDERS: readonly Provider[] = ["gemini", "anthropic"];

export type LlmErrorKind =
  /** 환경변수가 없거나 지원하지 않는 벤더 — 배포 설정 문제다. */
  | "not_configured"
  /** 모델이 응답 자체를 거부했다. 재질문해도 소용없다. */
  | "refusal"
  /** 두 번 물어봤는데도 계약에 맞는 JSON 이 안 나왔다. */
  | "invalid_output"
  /** 429. 키의 분당·일일 한도를 넘었다 — 호출부에서 안내가 필요하다. */
  | "rate_limited"
  /** 그 밖의 API·네트워크 실패. */
  | "upstream";

export class LlmError extends Error {
  constructor(
    readonly kind: LlmErrorKind,
    message: string,
    options?: { cause?: unknown },
  ) {
    super(message, options);
    this.name = "LlmError";
  }
}

export interface LlmConfig {
  provider: Provider;
  apiKey: string;
  model: string;
  /** model 이 과부하일 때 순서대로 넘어갈 대체 모델. */
  fallbackModels: string[];
  effort: Effort | undefined;
  /** gemini 사고 수준. undefined 면 모델 기본값. */
  thinkingLevel: ThinkingLevelName | undefined;
}

/**
 * 환경변수는 모듈 스코프가 아니라 호출 시점에 읽는다.
 * 모듈 스코프에서 읽으면 키 없는 CI 빌드가 깨진다(.github/workflows/ci.yml 참고).
 */
export function readConfig(): LlmConfig {
  // 기본값은 anthropic 이다 (CLAUDE.md §1, #54). 예전 기본값은 gemini 였는데,
  // 환경변수를 빠뜨린 배포가 조용히 Gemini 로 돌면 약관 위반이 된다 — Google 은
  // 개발자 API 와 Vertex 양쪽에서 18세 미만 대상 서비스를 금지하고, 위반이
  // 의심되면 즉시 중단할 수 있다(Cloud SST §20(f)). 빠뜨렸을 때 안전한 쪽으로 둔다.
  const raw = process.env.LLM_PROVIDER?.trim() || "anthropic";
  if (!PROVIDERS.includes(raw as Provider)) {
    throw new LlmError(
      "not_configured",
      `LLM_PROVIDER=${raw} 는 지원하지 않는다. ${PROVIDERS.join(" | ")} 중 하나여야 한다.`,
    );
  }
  const provider = raw as Provider;

  const apiKey = process.env.LLM_API_KEY?.trim();
  if (!apiKey) {
    throw new LlmError(
      "not_configured",
      "LLM_API_KEY 가 비어 있다. .env.local 또는 Vercel 환경변수를 확인해라.",
    );
  }

  const model = process.env.LLM_MODEL?.trim();
  if (!model) {
    throw new LlmError(
      "not_configured",
      "LLM_MODEL 이 비어 있다. `npm run llm:models` 로 쓸 수 있는 모델을 확인해라.",
    );
  }

  const fallbackModels = (process.env.LLM_MODEL_FALLBACK ?? "")
    .split(",")
    .map((name) => name.trim())
    .filter((name) => name && name !== model);

  const effort = process.env.LLM_EFFORT?.trim() as Effort | undefined;
  return {
    provider,
    apiKey,
    model,
    fallbackModels,
    effort: effort || undefined,
    thinkingLevel: readThinkingLevel(),
  };
}

/**
 * 데모 직전까지 조정한다 (issue #36). 잘못된 값은 모델 기본값으로 떨어뜨린다 —
 * 오타 하나로 검증 플로우가 멈추는 것보다 느린 편이 낫다.
 */
function readThinkingLevel(): ThinkingLevelName | undefined {
  const raw = process.env.LLM_THINKING_LEVEL?.trim().toLowerCase();
  if (!raw) return undefined;
  if ((THINKING_LEVELS as readonly string[]).includes(raw)) return raw as ThinkingLevelName;
  console.warn(
    `[ai] LLM_THINKING_LEVEL=${raw} 를 모르겠다. 모델 기본값으로 간다 (${THINKING_LEVELS.join(" | ")}).`,
  );
  return undefined;
}

export interface CallJsonOptions<T> {
  /** 로그에 찍히는 이름. 프롬프트 번호를 그대로 쓴다 — "gap-analysis" 처럼. */
  label: string;
  system: string;
  user: string;
  schema: z.ZodType<T>;
  maxTokens?: number;
  effort?: Effort;
  /** 밀리초. 학생이 로딩 화면을 보고 있는 호출은 짧게 잡는다. */
  timeoutMs?: number;
}

/**
 * 프롬프트를 던지고 계약에 맞는 JSON 하나를 받아온다.
 *
 * 방어는 3겹이다.
 * 1. 벤더에 JSON Schema 를 넘겨 출력 형식을 강제한다.
 * 2. 그래도 안 맞으면 본문 텍스트에서 JSON 을 건져 직접 검증한다.
 * 3. 그것도 실패하면 무엇이 틀렸는지 알려주고 한 번 더 묻는다.
 *
 * 세 겹을 다 통과하지 못하면 LlmError 를 던진다. 반쯤 맞는 값을 돌려주지 않는다 —
 * 호출부가 빈 껍데기를 화면에 그리는 것보다 명시적으로 실패하는 편이 낫다.
 *
 * 벤더가 스키마를 강제했더라도 zod 로 다시 검증한다. 형태를 신뢰하지 않는다 (CLAUDE.md §6).
 */
export async function callJson<T>(opts: CallJsonOptions<T>): Promise<T> {
  const {
    label,
    system,
    user,
    schema,
    maxTokens = 2048,
    timeoutMs = 30_000,
  } = opts;

  const config = readConfig();
  const effort = config.effort ?? opts.effort ?? "medium";

  let lastProblem = "";

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    const content =
      attempt === 1
        ? user
        : `${user}\n\n(직전 응답이 형식을 어겼다: ${lastProblem}\n설명이나 코드펜스 없이 JSON 객체 하나만 출력해라.)`;

    let response;
    const startedAt = Date.now();
    try {
      response = await call(config.provider, config.apiKey, {
        model: config.model,
        fallbackModels: config.fallbackModels,
        system,
        user: content,
        schema: schema as z.ZodType<unknown>,
        maxTokens,
        timeoutMs,
        effort,
        thinkingLevel: config.thinkingLevel,
      });
    } catch (error) {
      throw toLlmError(error, label);
    }

    // 어느 모델이 실제로 답했는지 한 줄 남긴다. 과부하로 대체 모델에 넘어가면
    // 채점 기준이 달라질 수 있는데(캘리브레이션은 기본 모델로만 잰다) 지금은
    // 그 사실이 아무 데도 안 남아, 심사 중 통과율이 흔들려도 원인을 못 짚는다.
    //
    // 학생이 쓴 글은 절대 남기지 않는다 — 모델명·소요 시간·호출 종류뿐이다
    // (처리방침의 수집 최소화 원칙).
    console.log(
      `[ai:${label}] ${response.model ?? config.model} ${Date.now() - startedAt}ms`,
    );

    if (response.stop === "refusal") {
      throw new LlmError(
        "refusal",
        `[${label}] 모델이 응답을 거부했다 (${response.detail ?? "unknown"}).`,
      );
    }

    const candidate =
      response.parsed !== undefined
        ? response.parsed
        : salvageJson(response.text);

    const result = schema.safeParse(candidate);
    if (result.success) {
      return result.data;
    }

    lastProblem =
      response.stop === "max_tokens"
        ? `max_tokens(${maxTokens}) 에 걸려 응답이 잘렸다`
        : describeFailure(candidate, result.error);

    if (attempt < MAX_ATTEMPTS) {
      console.warn(`[ai:${label}] 형식 위반으로 재시도한다: ${lastProblem}`);
    }
  }

  throw new LlmError(
    "invalid_output",
    `[${label}] ${MAX_ATTEMPTS}번 시도했지만 계약에 맞는 JSON 을 받지 못했다: ${lastProblem}`,
  );
}

/**
 * 코드펜스나 앞뒤 군말이 섞여 와도 JSON 객체 하나만 뽑아낸다.
 * 실패하면 undefined — 예외를 던지지 않는다. 호출부에서 재시도 사유로 쓴다.
 */
function salvageJson(text: string): unknown {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end <= start) return undefined;

  try {
    return JSON.parse(text.slice(start, end + 1));
  } catch {
    return undefined;
  }
}

function describeFailure(candidate: unknown, error: z.ZodError): string {
  if (candidate === undefined) return "JSON 객체를 찾지 못했다";
  return error.issues
    .slice(0, 3)
    .map((issue) => `${issue.path.join(".") || "(root)"}: ${issue.message}`)
    .join(", ");
}

function toLlmError(error: unknown, label: string): LlmError {
  if (error instanceof LlmError) return error;

  if (error instanceof ProviderCallError) {
    if (error.status === 429) {
      return new LlmError(
        "rate_limited",
        `[${label}] 요청 한도에 걸렸다 (429). 키의 요금제와 분당 한도를 확인한다.`,
        { cause: error },
      );
    }
    if (error.status === 401 || error.status === 403) {
      return new LlmError(
        "not_configured",
        `[${label}] LLM_API_KEY 가 유효하지 않다 (${error.status}).`,
        { cause: error },
      );
    }
    return new LlmError(
      "upstream",
      `[${label}] LLM 호출 실패 (${error.status ?? "network"}): ${error.message}`,
      { cause: error },
    );
  }

  return new LlmError(
    "upstream",
    `[${label}] LLM 호출 중 알 수 없는 오류: ${String(error)}`,
    { cause: error },
  );
}
