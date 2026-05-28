import type { ModelConfig } from "../types";
import { inferProviderFromBaseUrl, isApiKeyOptionalForProvider } from "./modelProviders";

type UnknownRecord = Record<string, unknown>;

interface ContentPart {
  type?: string;
  text?: string;
}

/** 去掉末尾斜杠；若用户粘贴了完整 /chat/completions 或 /embeddings 路径则保留 */
export function normalizeOpenAiBaseUrl(baseUrl: string): string {
  return baseUrl.trim().replace(/\/+$/, "");
}

export function openAiChatCompletionsUrl(baseUrl: string): string {
  const base = normalizeOpenAiBaseUrl(baseUrl);
  if (!base) return "";
  if (/\/chat\/completions$/i.test(base)) return base;
  return `${base}/chat/completions`;
}

export function openAiEmbeddingsUrl(baseUrl: string): string {
  const base = normalizeOpenAiBaseUrl(baseUrl);
  if (!base) return "";
  if (/\/embeddings$/i.test(base)) return base;
  return `${base}/embeddings`;
}

export function buildOpenAiHeaders(apiKey: string): HeadersInit {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  const key = apiKey.trim();
  if (key) headers.Authorization = `Bearer ${key}`;
  return headers;
}

export function isModelConfigReady(config: ModelConfig): boolean {
  const baseUrl = config.baseUrl.trim();
  const model = config.model.trim();
  if (!baseUrl || !model) return false;
  if (config.apiKey.trim()) return true;
  const provider = config.provider ?? inferProviderFromBaseUrl(baseUrl);
  return isApiKeyOptionalForProvider(provider, baseUrl);
}

/** 从 assistant message 提取文本（兼容字符串、多模态数组、DeepSeek reasoning 等） */
export function extractChatMessageContent(message: unknown): string | null {
  if (!message || typeof message !== "object") return null;
  const record = message as UnknownRecord;

  const content = record.content;
  if (typeof content === "string") {
    const trimmed = content.trim();
    if (trimmed) return trimmed;
  }

  if (Array.isArray(content)) {
    const joined = content
      .map((part) => {
        if (typeof part === "string") return part;
        if (part && typeof part === "object") {
          const text = (part as ContentPart).text;
          return typeof text === "string" ? text : "";
        }
        return "";
      })
      .join("")
      .trim();
    if (joined) return joined;
  }

  const reasoning = record.reasoning_content;
  if (typeof reasoning === "string" && reasoning.trim()) {
    return reasoning.trim();
  }

  return null;
}

export function extractChatChoiceText(choice: unknown): string | null {
  if (!choice || typeof choice !== "object") return null;
  const record = choice as UnknownRecord;
  const fromMessage = extractChatMessageContent(record.message);
  if (fromMessage) return fromMessage;
  if (typeof record.text === "string" && record.text.trim()) {
    return record.text.trim();
  }
  return null;
}

export function extractChatDeltaText(delta: unknown): string | null {
  if (!delta || typeof delta !== "object") return null;
  const record = delta as UnknownRecord;
  if (typeof record.content === "string" && record.content.length > 0) {
    return record.content;
  }
  if (typeof record.reasoning_content === "string" && record.reasoning_content.length > 0) {
    return record.reasoning_content;
  }
  return extractChatMessageContent(delta);
}
