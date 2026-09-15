/**
 * ai/server/providers — 벤더별 어댑터. owner: 강민구
 *
 * callJson(llm.ts)이 벤더를 몰라도 되게 여기서 차이를 흡수한다.
 * 어댑터는 "JSON 을 강제해서 한 번 물어본다"까지만 한다 —
 * 검증·복구·재질문은 전부 llm.ts 소관이다.
 *
 * 프로덕션에서 쓰는 벤더는 하나다 (CLAUDE.md §1, plan-ko.md §5-2).
 * 어댑터가 둘인 건 4번 작업(독후감 20건 채점 기준 잡기)에서 모델을 갈아 끼우며
 * 비교하기 위해서다. LLM_PROVIDER 로 하나만 살아난다.
 */
import "server-only";

import Anthropic from "@anthropic-ai/sdk";
import { GoogleGenAI, ThinkingLevel } from "@google/genai";
import { z } from "zod";

export type Provider = "gemini" | "anthropic";

/** 사고 깊이. anthropic 전용 — gemini 는 thinkingLevel 을 쓴다. */
export type Effort = "low" | "medium" | "high" | "xhigh" | "max";

/**
 * gemini 사고 수준. 비우면 모델 기본값이다.
 *
 * flash 는 기본값에서 사고 토큰을 입력마다 크게 다르게 써서(질문 한 번에 최대 1483)
 * maxTokens 를 넘기고, 지연도 LOW 의 두 배쯤이다. 측정은 issue #36.
 */
export const THINKING_LEVELS = ["minimal", "low", "medium", "high"] as const;
export type ThinkingLevelName = (typeof THINKING_LEVELS)[number];

const GEMINI_THINKING: Record<ThinkingLevelName, ThinkingLevel> = {
  minimal: ThinkingLevel.MINIMAL,
  low: ThinkingLevel.LOW,
  medium: ThinkingLevel.MEDIUM,
  high: ThinkingLevel.HIGH,
};

export interface ProviderRequest {
  model: string;
  /** model 이 계속 실패할 때 순서대로 넘어갈 대체 모델. */
  fallbackModels: string[];
  system: string;
  user: string;
  schema: z.ZodType<unknown>;
  maxTokens: number;
  timeoutMs: number;
  effort: Effort;
  thinkingLevel?: ThinkingLevelName;
}

export interface ProviderResponse {
  /** 벤더가 스키마를 강제해 돌려준 값. 그래도 신뢰하지 않고 llm.ts 에서 다시 검증한다. */
  parsed?: unknown;
  /** 본문 텍스트. parsed 가 비었을 때 복구 파싱에 쓴다. */
  text: string;
  stop: "ok" | "refusal" | "max_tokens";
  /** 거부 사유 등, 로그에 남길 부가 정보. */
  detail?: string;
}

/** 벤더 호출이 실패했을 때 llm.ts 가 분류할 수 있게 상태 코드를 보존한다. */
export class ProviderCallError extends Error {
  constructor(
    readonly status: number | undefined,
    message: string,
    options?: { cause?: unknown },
  ) {
    super(message, options);
    this.name = "ProviderCallError";
  }
}

/* ── gemini ────────────────────────────────────────── */

let geminiClient: { apiKey: string; client: GoogleGenAI } | null = null;

function getGemini(apiKey: string): GoogleGenAI {
  if (geminiClient?.apiKey !== apiKey) {
    geminiClient = { apiKey, client: new GoogleGenAI({ apiKey }) };
  }
  return geminiClient.client;
}

/**
 * zod 스키마를 Gemini 가 받는 JSON Schema 로 바꾼다.
 * `$schema` 키는 Gemini 가 모르는 필드라 떼어낸다.
 */
function toGeminiSchema(schema: z.ZodType<unknown>): unknown {
  const json = z.toJSONSchema(schema, { io: "output" }) as Record<string, unknown>;
  delete json.$schema;
  return json;
}

async function callGemini(
  apiKey: string,
  req: ProviderRequest,
): Promise<ProviderResponse> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), req.timeoutMs);

  try {
    const response = await getGemini(apiKey).models.generateContent({
      model: req.model,
      contents: req.user,
      config: {
        systemInstruction: req.system,
        responseMimeType: "application/json",
        responseJsonSchema: toGeminiSchema(req.schema),
        // ⚠️ Gemini 의 maxOutputTokens 는 사고(thinking) 토큰까지 포함한다.
        // 실제 답이 한 문장이어도 여유 있게 잡아야 MAX_TOKENS 로 잘리지 않는다.
        maxOutputTokens: req.maxTokens,
        // 비우면 thinkingConfig 자체를 안 보낸다 — 모델 기본값 그대로다.
        ...(req.thinkingLevel && {
          thinkingConfig: { thinkingLevel: GEMINI_THINKING[req.thinkingLevel] },
        }),
        abortSignal: controller.signal,
      },
    });

    const finish = response.candidates?.[0]?.finishReason;
    const text = response.text ?? "";

    // SAFETY·PROHIBITED_CONTENT 등은 거부로 본다. 재질문해도 소용없다.
    const refused =
      finish != null && !["STOP", "MAX_TOKENS", undefined].includes(String(finish));

    return {
      text,
      stop: refused ? "refusal" : finish === "MAX_TOKENS" ? "max_tokens" : "ok",
      detail: refused ? String(finish) : undefined,
    };
  } catch (error) {
    if (controller.signal.aborted) {
      throw new ProviderCallError(408, `${req.timeoutMs}ms 안에 응답이 없었다`, {
        cause: error,
      });
    }
    const status =
      typeof error === "object" && error !== null && "status" in error
        ? Number((error as { status: unknown }).status)
        : undefined;
    throw new ProviderCallError(
      Number.isFinite(status) ? status : undefined,
      error instanceof Error ? error.message : String(error),
      { cause: error },
    );
  } finally {
    clearTimeout(timer);
  }
}

/* ── anthropic ─────────────────────────────────────── */

let anthropicClient: { apiKey: string; client: Anthropic } | null = null;

function getAnthropic(apiKey: string): Anthropic {
  if (anthropicClient?.apiKey !== apiKey) {
    // 429·5xx·연결 실패는 SDK 가 알아서 재시도한다.
    anthropicClient = { apiKey, client: new Anthropic({ apiKey, maxRetries: 2 }) };
  }
  return anthropicClient.client;
}

async function callAnthropic(
  apiKey: string,
  req: ProviderRequest,
): Promise<ProviderResponse> {
  try {
    const message = await getAnthropic(apiKey).messages.create(
      {
        model: req.model,
        max_tokens: req.maxTokens,
        system: req.system,
        messages: [{ role: "user", content: req.user }],
        output_config: {
          effort: req.effort,
          format: {
            type: "json_schema",
            schema: z.toJSONSchema(req.schema, { io: "output" }),
          },
        },
      },
      { timeout: req.timeoutMs },
    );

    const text = message.content
      .filter((block): block is Anthropic.TextBlock => block.type === "text")
      .map((block) => block.text)
      .join("\n");

    return {
      text,
      stop:
        message.stop_reason === "refusal"
          ? "refusal"
          : message.stop_reason === "max_tokens"
            ? "max_tokens"
            : "ok",
      detail: message.stop_details?.category ?? undefined,
    };
  } catch (error) {
    if (error instanceof Anthropic.APIError) {
      throw new ProviderCallError(error.status, error.message, { cause: error });
    }
    throw new ProviderCallError(
      undefined,
      error instanceof Error ? error.message : String(error),
      { cause: error },
    );
  }
}

/* ── 디스패치 ──────────────────────────────────────── */

/** 같은 모델로 잠깐 뒤 다시 하면 되는 상태 코드. 408 은 우리가 붙인 타임아웃이다. */
const TRANSIENT_STATUS = new Set([408, 500, 502, 503, 504]);

/**
 * 한도 초과. 같은 모델로 다시 해도 소용없으니 곧장 대체 모델로 넘어간다.
 *
 * 무료 티어로 개발할 때 한도가 모델 단위였다 —
 * quotaId 가 GenerateRequestsPerDayPerProjectPerModel-FreeTier 로 찍혔다.
 * 그래서 모델을 갈아타면 남은 한도가 새로 생긴다.
 * 대회 기간은 유료 티어라(#29) 한도에 걸릴 일이 드물지만, 무료 키로 로컬에서
 * 돌릴 때를 위해 그대로 둔다.
 */
const QUOTA_STATUS = 429;

/** 재시도 간격. 총 대기가 1.6초를 넘지 않게 짧게 잡는다 — 학생이 로딩 화면을 보고 있다. */
const RETRY_DELAYS_MS = [400, 1200];

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * 한 번 호출한다. 일시적 실패는 물러섰다가 다시, 그래도 안 되면 대체 모델로 넘어간다.
 *
 * 무료 티어에서 최신 모델은 503(과부하)이 실제로 난다. 심사 기간 내내 링크가
 * 살아 있어야 하므로(plan-ko.md §5-3) 한 번 실패했다고 화면을 죽이지 않는다.
 */
export async function call(
  provider: Provider,
  apiKey: string,
  req: ProviderRequest,
): Promise<ProviderResponse> {
  const models = [req.model, ...req.fallbackModels];
  let lastError: unknown;

  for (const model of models) {
    let moveOn = false;

    for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length && !moveOn; attempt += 1) {
      try {
        const request = { ...req, model };
        return provider === "gemini"
          ? await callGemini(apiKey, request)
          : await callAnthropic(apiKey, request);
      } catch (error) {
        lastError = error;
        if (!(error instanceof ProviderCallError)) throw error;

        if (error.status === QUOTA_STATUS) {
          // 한도는 기다린다고 풀리지 않는다. 남은 한도가 있는 모델로 바로 넘어간다.
          console.warn(`[ai] ${model} 한도 초과(429).`);
          moveOn = true;
          continue;
        }

        const transient =
          error.status === undefined || TRANSIENT_STATUS.has(error.status);
        if (!transient) throw error;

        if (attempt < RETRY_DELAYS_MS.length) {
          await sleep(RETRY_DELAYS_MS[attempt]);
        }
      }
    }

    if (model !== models[models.length - 1]) {
      console.warn(`[ai] 대체 모델로 넘어간다.`);
    }
  }

  throw lastError;
}

/** 발급받은 키로 실제 쓸 수 있는 모델 목록. LLM_MODEL 값을 정할 때 쓴다. */
export async function listModels(
  provider: Provider,
  apiKey: string,
): Promise<string[]> {
  if (provider === "gemini") {
    const names: string[] = [];
    for await (const model of await getGemini(apiKey).models.list()) {
      if (model.name) names.push(model.name.replace(/^models\//, ""));
    }
    return names;
  }

  const page = await getAnthropic(apiKey).models.list({ limit: 50 });
  return page.data.map((model) => model.id);
}
