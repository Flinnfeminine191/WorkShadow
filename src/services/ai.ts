import type { AppSettings, ModelConfig } from "../types";
import { isDevVerboseApiLogging, logLlmRequest, logLlmResponse, logUserAction } from "./apiTrace";
import { modelConfigForRequest } from "./modelProviders";
import {
  buildOpenAiHeaders,
  extractChatChoiceText,
  extractChatDeltaText,
  isModelConfigReady,
  openAiChatCompletionsUrl
} from "./openaiCompat";

interface ChatMessage {
  role: "system" | "user";
  content: unknown;
}

export interface CompleteChatTextMeta {
  /** 用于应用日志区分场景，如 log_summary / log_qa */
  purpose: string;
}

export interface StreamChatTextOptions {
  purpose: string;
  onDelta: (delta: string) => void;
  signal?: AbortSignal;
}

/** 从 OpenAI 兼容 SSE 单行解析 content delta；非 data 行或 [DONE] 返回 null */
export function extractContentDeltaFromSseLine(line: string): string | null {
  const trimmed = line.trim();
  if (!trimmed.startsWith("data:")) return null;
  const payload = trimmed.slice(5).trim();
  if (!payload || payload === "[DONE]") return null;
  try {
    const json = JSON.parse(payload) as {
      choices?: Array<{ delta?: { content?: string | null }; message?: { content?: string } }>;
    };
    const choice = json.choices?.[0];
    const fromDelta = extractChatDeltaText(choice?.delta);
    if (fromDelta) return fromDelta;
    const fromMessage = extractChatDeltaText(choice?.message);
    if (fromMessage) return fromMessage;
  } catch {
    return null;
  }
  return null;
}

/** 将 SSE 文本块按行解析并回调增量（供测试与流式读取共用） */
export function consumeSseChatBuffer(buffer: string, onDelta: (delta: string) => void): string {
  const lines = buffer.split("\n");
  let out = "";
  for (const line of lines) {
    const delta = extractContentDeltaFromSseLine(line);
    if (delta) {
      out += delta;
      onDelta(delta);
    }
  }
  return out;
}

export async function readChatCompletionStream(
  response: Response,
  onDelta: (delta: string) => void
): Promise<string> {
  const reader = response.body?.getReader();
  if (!reader) {
    throw new Error("LLM stream response has no body");
  }
  const decoder = new TextDecoder();
  let buffer = "";
  let full = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      const delta = extractContentDeltaFromSseLine(line);
      if (delta) {
        full += delta;
        onDelta(delta);
      }
    }
  }
  if (buffer.trim()) {
    const delta = extractContentDeltaFromSseLine(buffer);
    if (delta) {
      full += delta;
      onDelta(delta);
    }
  }
  return full;
}

async function postChatCompletions(
  config: ModelConfig,
  body: Record<string, unknown>,
  errorLabel: string,
  init?: RequestInit
) {
  const ready = modelConfigForRequest(config);
  if (!isModelConfigReady(ready)) {
    return null;
  }
  const response = await fetch(openAiChatCompletionsUrl(ready.baseUrl), {
    method: "POST",
    headers: buildOpenAiHeaders(ready.apiKey),
    body: JSON.stringify(body),
    signal: init?.signal
  });
  if (!response.ok) {
    throw new Error(`${errorLabel} request failed: ${response.status} ${response.statusText}`);
  }
  return response;
}

async function callChatCompletions(config: ModelConfig, messages: ChatMessage[], errorLabel: string) {
  const ready = modelConfigForRequest(config);
  const response = await postChatCompletions(
    ready,
    { model: ready.model, messages, temperature: 0.2 },
    errorLabel
  );
  if (!response) return null;
  const data = (await response.json()) as { choices?: unknown[] };
  return extractChatChoiceText(data.choices?.[0]) ?? null;
}

/** 文本 LLM：用于日志总结、日志问答等（使用设置中的 LLM 配置） */
export async function completeChatText(
  settings: AppSettings,
  system: string,
  user: string,
  meta?: CompleteChatTextMeta
): Promise<string> {
  const llm = modelConfigForRequest(settings.llm);
  const model = llm.model.trim();
  const purpose = meta?.purpose ?? "llm";

  if (isDevVerboseApiLogging()) {
    await logLlmRequest(purpose, system, user, model);
  } else if (meta?.purpose && meta.purpose !== "log_qa" && meta.purpose !== "log_summary") {
    await logUserAction("llm", meta.purpose, {
      model,
      systemChars: system.length,
      userChars: user.length
    });
  }

  const text = await callChatCompletions(
    llm,
    [
      { role: "system", content: system },
      { role: "user", content: user }
    ],
    "LLM"
  );

  if (text == null || !text.trim()) {
    throw new Error("LLM is not configured or returned empty text. Set Base URL, API Key, and model in Settings.");
  }

  if (isDevVerboseApiLogging()) {
    await logLlmResponse(purpose, text, model);
  }

  return text;
}

/** 流式文本 LLM（OpenAI 兼容 SSE）；返回完整拼接文本 */
export async function streamChatText(
  settings: AppSettings,
  system: string,
  user: string,
  options: StreamChatTextOptions
): Promise<string> {
  const llm = modelConfigForRequest(settings.llm);
  const model = llm.model.trim();
  const purpose = options.purpose;

  if (isDevVerboseApiLogging()) {
    await logLlmRequest(purpose, system, user, model);
  }

  const response = await postChatCompletions(
    llm,
    {
      model: llm.model,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user }
      ],
      temperature: 0.2,
      stream: true
    },
    "LLM stream",
    { signal: options.signal }
  );

  if (!response) {
    throw new Error("LLM is not configured. Set Base URL, API Key, and model in Settings.");
  }

  const text = (await readChatCompletionStream(response, options.onDelta)).trim();
  if (!text) {
    throw new Error("LLM stream returned empty text. Check model and API compatibility with streaming.");
  }

  if (isDevVerboseApiLogging()) {
    await logLlmResponse(purpose, text, model);
  }

  return text;
}
