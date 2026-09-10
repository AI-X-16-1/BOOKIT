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
import { GoogleGenAI } from "@google/genai";
import { z } from "zod";

export type Provider = "gemini" | "anthropic";

/** 사고 깊이. anthropic 전용 — gemini 는 모델 기본값을 쓴다. */
export type Effort = "low" | "medium" | "high" | "xhigh" | "max";

export interface ProviderRequest {
  model: string;
  system: string;
  user: string;
  schema: z.ZodType<unknown>;
  maxTokens: number;
  timeoutMs: number;
  effort: Effort;
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
        maxOutputTokens: req.maxTokens,
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

export function call(
  provider: Provider,
  apiKey: string,
  req: ProviderRequest,
): Promise<ProviderResponse> {
  return provider === "gemini"
    ? callGemini(apiKey, req)
    : callAnthropic(apiKey, req);
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
