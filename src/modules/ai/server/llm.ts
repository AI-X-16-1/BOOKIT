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
 * 벤더는 Anthropic 하나로 고정한다(1일차 결정, .env.example 참고).
 * 모델 문자열은 LLM_MODEL 로 빼 두었다 — 대회 제출서에 들어가는 값이라 코드에 박지 않는다.
 */
import "server-only";

import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import type { z } from "zod";

/** LLM_MODEL 이 비어 있을 때 쓰는 값. */
const DEFAULT_MODEL = "claude-opus-5";

/** 형식이 어긋났을 때 다시 물어보는 횟수 포함 총 시도 횟수. */
const MAX_ATTEMPTS = 2;

/**
 * 사고 깊이. 낮출수록 싸고 빠르다.
 * 데모 직전 지연이 문제가 되면 LLM_EFFORT 로 통째로 낮출 수 있다.
 */
export type Effort = "low" | "medium" | "high" | "xhigh" | "max";

export type LlmErrorKind =
  /** 환경변수가 없거나 지원하지 않는 벤더 — 배포 설정 문제다. */
  | "not_configured"
  /** 모델이 응답 자체를 거부했다. */
  | "refusal"
  /** 두 번 물어봤는데도 계약에 맞는 JSON 이 안 나왔다. */
  | "invalid_output"
  /** 429. 호출부에서 잠시 뒤 재시도하거나 사용자에게 안내한다. */
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

interface LlmConfig {
  apiKey: string;
  model: string;
  effort: Effort | undefined;
}

/**
 * 환경변수는 모듈 스코프가 아니라 호출 시점에 읽는다.
 * 모듈 스코프에서 읽으면 키 없는 CI 빌드가 깨진다(.github/workflows/ci.yml 참고).
 */
function readConfig(): LlmConfig {
  const provider = process.env.LLM_PROVIDER?.trim() || "anthropic";
  if (provider !== "anthropic") {
    throw new LlmError(
      "not_configured",
      `LLM_PROVIDER=${provider} 는 지원하지 않는다. 벤더는 anthropic 하나로 고정이다 (CLAUDE.md §1).`,
    );
  }

  const apiKey = process.env.LLM_API_KEY?.trim();
  if (!apiKey) {
    throw new LlmError(
      "not_configured",
      "LLM_API_KEY 가 비어 있다. .env.local 또는 Vercel 환경변수를 확인해라.",
    );
  }

  const effort = process.env.LLM_EFFORT?.trim() as Effort | undefined;

  return {
    apiKey,
    model: process.env.LLM_MODEL?.trim() || DEFAULT_MODEL,
    effort: effort || undefined,
  };
}

let cachedClient: { apiKey: string; client: Anthropic } | null = null;

function getClient(apiKey: string): Anthropic {
  if (cachedClient?.apiKey !== apiKey) {
    cachedClient = {
      apiKey,
      // 429·5xx·연결 실패는 SDK 가 알아서 재시도한다.
      // 여기서 세는 MAX_ATTEMPTS 는 "형식이 틀렸을 때 다시 묻는" 횟수라 층이 다르다.
      client: new Anthropic({ apiKey, maxRetries: 2 }),
    };
  }
  return cachedClient.client;
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
 * 1. output_config.format 으로 서버가 스키마를 강제한다.
 * 2. 그래도 parsed_output 이 비면 본문 텍스트에서 JSON 을 건져 직접 검증한다.
 * 3. 그것도 실패하면 무엇이 틀렸는지 알려주고 한 번 더 묻는다.
 *
 * 세 겹을 다 통과하지 못하면 LlmError 를 던진다. 반쯤 맞는 값을 돌려주지 않는다 —
 * 호출부가 빈 껍데기를 화면에 그리는 것보다 명시적으로 실패하는 편이 낫다.
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
  const client = getClient(config.apiKey);
  const effort = config.effort ?? opts.effort ?? "medium";
  const format = zodOutputFormat(schema);

  let lastProblem = "";

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    const content =
      attempt === 1
        ? user
        : `${user}\n\n(직전 응답이 형식을 어겼다: ${lastProblem}\n설명이나 코드펜스 없이 JSON 객체 하나만 출력해라.)`;

    let message;
    try {
      message = await client.messages.parse(
        {
          model: config.model,
          max_tokens: maxTokens,
          system,
          messages: [{ role: "user", content }],
          output_config: { effort, format },
        },
        { timeout: timeoutMs },
      );
    } catch (error) {
      throw toLlmError(error, label);
    }

    if (message.stop_reason === "refusal") {
      throw new LlmError(
        "refusal",
        `[${label}] 모델이 응답을 거부했다 (${message.stop_details?.category ?? "unknown"}).`,
      );
    }

    const parsed = message.parsed_output;
    if (parsed != null) {
      return parsed;
    }

    // 구조화 출력이 비었다 — 본문에서 직접 건져 본다.
    const salvaged = salvageJson(textOf(message));
    const result = schema.safeParse(salvaged);
    if (result.success) {
      console.warn(`[ai:${label}] 구조화 출력이 비어 본문에서 JSON 을 복구했다.`);
      return result.data;
    }

    lastProblem =
      message.stop_reason === "max_tokens"
        ? `max_tokens(${maxTokens}) 에 걸려 응답이 잘렸다`
        : describeFailure(salvaged, result.error);

    if (attempt < MAX_ATTEMPTS) {
      console.warn(`[ai:${label}] 형식 위반으로 재시도한다: ${lastProblem}`);
    }
  }

  throw new LlmError(
    "invalid_output",
    `[${label}] ${MAX_ATTEMPTS}번 시도했지만 계약에 맞는 JSON 을 받지 못했다: ${lastProblem}`,
  );
}

function textOf(message: { content: Anthropic.ContentBlock[] }): string {
  return message.content
    .filter((block): block is Anthropic.TextBlock => block.type === "text")
    .map((block) => block.text)
    .join("\n");
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

function describeFailure(salvaged: unknown, error: z.ZodError): string {
  if (salvaged === undefined) return "JSON 객체를 찾지 못했다";
  return error.issues
    .slice(0, 3)
    .map((issue) => `${issue.path.join(".") || "(root)"}: ${issue.message}`)
    .join(", ");
}

function toLlmError(error: unknown, label: string): LlmError {
  if (error instanceof LlmError) return error;

  if (error instanceof Anthropic.RateLimitError) {
    return new LlmError("rate_limited", `[${label}] 요청이 몰렸다 (429).`, {
      cause: error,
    });
  }
  if (error instanceof Anthropic.AuthenticationError) {
    return new LlmError(
      "not_configured",
      `[${label}] LLM_API_KEY 가 유효하지 않다 (401).`,
      { cause: error },
    );
  }
  if (error instanceof Anthropic.APIError) {
    return new LlmError(
      "upstream",
      `[${label}] LLM 호출 실패 (${error.status}): ${error.message}`,
      { cause: error },
    );
  }

  return new LlmError(
    "upstream",
    `[${label}] LLM 호출 중 알 수 없는 오류: ${String(error)}`,
    { cause: error },
  );
}
