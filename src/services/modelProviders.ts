import type { ModelConfig } from "../types";

/** 服务商 ID，与 MODEL_PROVIDER_PRESETS 一致 */
export type ModelProvider =
  | "openaiCompatible"
  | "openai"
  | "aliyun"
  | "gemini"
  | "anthropic"
  | "siliconflow"
  | "deepseek"
  | "tencent"
  | "ollama";

export type ModelProtocol = "openaiCompatible" | "anthropic";

export const MODEL_PROVIDER_IDS: ModelProvider[] = [
  "openaiCompatible",
  "openai",
  "aliyun",
  "gemini",
  "anthropic",
  "siliconflow",
  "deepseek",
  "tencent",
  "ollama"
];

export function isModelProvider(value: string): value is ModelProvider {
  return (MODEL_PROVIDER_IDS as string[]).includes(value);
}

export function normalizeModelProvider(raw: unknown): ModelProvider {
  if (typeof raw === "string") {
    if (raw === "custom") return "openaiCompatible";
    if (isModelProvider(raw)) return raw;
  }
  return "openaiCompatible";
}

export interface ModelProviderPreset {
  id: ModelProvider;
  labelKey: string;
  baseUrl: string;
  defaultModel?: string;
  protocol: ModelProtocol;
  supportsEmbedding: boolean;
  apiKeyOptional?: boolean;
  hintKey?: string;
}

export const MODEL_PROVIDER_PRESETS: ModelProviderPreset[] = [
  {
    id: "openaiCompatible",
    labelKey: "openaiCompatible",
    baseUrl: "",
    protocol: "openaiCompatible",
    supportsEmbedding: true,
    apiKeyOptional: true,
    hintKey: "customHint"
  },
  {
    id: "openai",
    labelKey: "openai",
    baseUrl: "https://api.openai.com/v1",
    defaultModel: "gpt-4o-mini",
    protocol: "openaiCompatible",
    supportsEmbedding: true
  },
  {
    id: "aliyun",
    labelKey: "aliyun",
    baseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1",
    defaultModel: "qwen-plus",
    protocol: "openaiCompatible",
    supportsEmbedding: true
  },
  {
    id: "gemini",
    labelKey: "gemini",
    baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai",
    defaultModel: "gemini-2.0-flash",
    protocol: "openaiCompatible",
    supportsEmbedding: true,
    hintKey: "geminiHint"
  },
  {
    id: "anthropic",
    labelKey: "anthropic",
    baseUrl: "https://api.anthropic.com/v1",
    defaultModel: "claude-sonnet-4-20250514",
    protocol: "anthropic",
    supportsEmbedding: false,
    hintKey: "anthropicHint"
  },
  {
    id: "siliconflow",
    labelKey: "siliconflow",
    baseUrl: "https://api.siliconflow.cn/v1",
    defaultModel: "deepseek-ai/DeepSeek-V3",
    protocol: "openaiCompatible",
    supportsEmbedding: true
  },
  {
    id: "deepseek",
    labelKey: "deepseek",
    baseUrl: "https://api.deepseek.com/v1",
    defaultModel: "deepseek-chat",
    protocol: "openaiCompatible",
    supportsEmbedding: false,
    hintKey: "deepseekHint"
  },
  {
    id: "tencent",
    labelKey: "tencent",
    baseUrl: "https://api.hunyuan.cloud.tencent.com/v1",
    defaultModel: "hunyuan-lite",
    protocol: "openaiCompatible",
    supportsEmbedding: true
  },
  {
    id: "ollama",
    labelKey: "ollama",
    baseUrl: "http://127.0.0.1:11434/v1",
    defaultModel: "llama3.2",
    protocol: "openaiCompatible",
    supportsEmbedding: true,
    apiKeyOptional: true,
    hintKey: "ollamaHint"
  }
];

export function getModelProviderPreset(id: ModelProvider): ModelProviderPreset {
  return MODEL_PROVIDER_PRESETS.find((p) => p.id === id) ?? MODEL_PROVIDER_PRESETS[0];
}

export function modelProtocol(provider: ModelProvider): ModelProtocol {
  return getModelProviderPreset(provider).protocol;
}

export function inferProviderFromBaseUrl(baseUrl: string): ModelProvider {
  const normalized = baseUrl.trim().toLowerCase().replace(/\/+$/, "");
  if (!normalized) return "openaiCompatible";

  for (const preset of MODEL_PROVIDER_PRESETS) {
    if (preset.id === "openaiCompatible") continue;
    const presetBase = preset.baseUrl.toLowerCase().replace(/\/+$/, "");
    if (normalized === presetBase || normalized.startsWith(`${presetBase}/`)) {
      return preset.id;
    }
  }
  return "openaiCompatible";
}

export function isApiKeyOptionalForProvider(provider: ModelProvider, baseUrl: string): boolean {
  const preset = getModelProviderPreset(provider);
  if (preset.apiKeyOptional) return true;
  try {
    const host = new URL(baseUrl.trim()).hostname.toLowerCase();
    return host === "localhost" || host === "127.0.0.1" || host === "::1";
  } catch {
    return false;
  }
}

export function modelConfigForRequest(config: ModelConfig): ModelConfig {
  return {
    provider: config.provider,
    baseUrl: config.baseUrl.trim(),
    apiKey: config.apiKey.trim(),
    model: config.model.trim()
  };
}

export function applyModelProvider(provider: ModelProvider, current?: ModelConfig): ModelConfig {
  const preset = getModelProviderPreset(provider);
  const prev = current ?? { provider, baseUrl: "", apiKey: "", model: "" };
  return {
    provider,
    baseUrl: preset.baseUrl || prev.baseUrl,
    apiKey: prev.provider === provider ? prev.apiKey : "",
    model: preset.defaultModel ?? prev.model
  };
}
