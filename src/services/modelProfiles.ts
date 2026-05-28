import {
  applyModelProvider,
  getModelProviderPreset,
  inferProviderFromBaseUrl,
  isApiKeyOptionalForProvider,
  isModelProvider,
  normalizeModelProvider,
  type ModelProvider
} from "./modelProviders";
import type { ModelConfig, ModelProfiles } from "../types";

export function emptyModelConfig(provider: ModelProvider = "openaiCompatible"): ModelConfig {
  return applyModelProvider(provider);
}

export function normalizeModelConfig(raw: unknown, fallbackProvider?: ModelProvider): ModelConfig {
  const m = raw && typeof raw === "object" && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
  const baseUrl = typeof m.baseUrl === "string" ? m.baseUrl : "";
  const provider =
    m.provider !== undefined
      ? normalizeModelProvider(m.provider)
      : (fallbackProvider ?? inferProviderFromBaseUrl(baseUrl));
  return {
    provider,
    baseUrl,
    apiKey: typeof m.apiKey === "string" ? m.apiKey : "",
    model: typeof m.model === "string" ? m.model : ""
  };
}

export function coerceSingleModelProfile(raw: unknown, fallbackProvider?: ModelProvider): ModelConfig | undefined {
  if (Array.isArray(raw)) {
    const last = raw[raw.length - 1];
    return last !== undefined ? normalizeModelConfig(last, fallbackProvider) : undefined;
  }
  if (raw && typeof raw === "object") {
    return normalizeModelConfig(raw, fallbackProvider);
  }
  return undefined;
}

/** 是否为用户真实填写过的配置（仅有预设 Base URL / 默认模型名不算） */
export function isProfileMeaningfullyStored(config: ModelConfig): boolean {
  const provider = config.provider ?? inferProviderFromBaseUrl(config.baseUrl);
  const preset = getModelProviderPreset(provider);
  const apiKey = config.apiKey.trim();
  const baseUrl = config.baseUrl.trim();
  const model = config.model.trim();

  if (apiKey) return true;

  if (!isApiKeyOptionalForProvider(provider, baseUrl)) {
    return false;
  }

  if (!baseUrl || !model) return false;
  const presetBase = preset.baseUrl.replace(/\/+$/, "");
  const normBase = baseUrl.replace(/\/+$/, "");
  const urlDiffers = presetBase ? normBase !== presetBase : Boolean(normBase);
  const modelDiffers = preset.defaultModel ? model !== preset.defaultModel : Boolean(model);
  return urlDiffers || modelDiffers;
}

export function sanitizeModelProfiles(raw: unknown): ModelProfiles {
  const out: ModelProfiles = {};
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return out;
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    const provider = normalizeModelProvider(key);
    const config = coerceSingleModelProfile(value, provider);
    if (config && isProfileMeaningfullyStored({ ...config, provider })) {
      out[provider] = { ...config, provider };
    }
  }
  return out;
}

/** 从旧版 { activeProvider, configs } 迁移 */
function migrateNestedProviderSettings(raw: unknown): { active: ModelConfig; profiles: ModelProfiles } | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const record = raw as Record<string, unknown>;
  if (!("configs" in record) || !("activeProvider" in record)) return null;

  const profiles: ModelProfiles = {};
  if (record.configs && typeof record.configs === "object" && !Array.isArray(record.configs)) {
    for (const [key, value] of Object.entries(record.configs as Record<string, unknown>)) {
      const provider = normalizeModelProvider(key);
      const config = coerceSingleModelProfile(value, provider);
      if (config) profiles[provider] = { ...config, provider };
    }
  }
  const activeProvider = normalizeModelProvider(record.activeProvider);
  const active = profiles[activeProvider] ?? emptyModelConfig(activeProvider);
  return { active, profiles };
}

export function loadModelSlot(
  raw: unknown,
  profilesRaw?: unknown
): { active: ModelConfig; profiles: ModelProfiles } {
  const migrated = migrateNestedProviderSettings(raw);
  if (migrated) return migrated;
  const active = normalizeModelConfig(raw);
  return { active, profiles: normalizeModelProfiles(profilesRaw, active) };
}

export function normalizeModelProfiles(raw: unknown, active: ModelConfig): ModelProfiles {
  const migrated = migrateNestedProviderSettings(raw);
  if (migrated) return sanitizeModelProfiles({ ...migrated.profiles, [active.provider ?? "openaiCompatible"]: active });

  const profiles = sanitizeModelProfiles(raw);
  const provider = active.provider ?? "openaiCompatible";
  if (!profiles[provider] && isProfileMeaningfullyStored(active)) {
    profiles[provider] = active;
  }
  return profiles;
}

export function upsertModelProfile(profiles: ModelProfiles, config: ModelConfig): ModelProfiles {
  const provider = config.provider ?? "openaiCompatible";
  return {
    ...profiles,
    [provider]: { ...config, provider }
  };
}

export function switchModelProviderProfile(
  profiles: ModelProfiles,
  current: ModelConfig,
  nextProvider: ModelProvider
): { config: ModelConfig; profiles: ModelProfiles } {
  const currentProvider = current.provider ?? "openaiCompatible";
  let saved = profiles;
  if (isProfileMeaningfullyStored({ ...current, provider: currentProvider })) {
    saved = upsertModelProfile(profiles, current);
  }
  const existing = saved[nextProvider];
  const config = existing ?? applyModelProvider(nextProvider, { provider: nextProvider, baseUrl: "", apiKey: "", model: "" });
  return {
    profiles: saved,
    config: { ...config, provider: nextProvider }
  };
}

export function modelProfilesEqual(a: ModelProfiles, b: ModelProfiles): boolean {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  for (const key of keys) {
    if (!isModelProvider(key)) continue;
    const left = normalizeModelConfig(a[key as ModelProvider], key as ModelProvider);
    const right = normalizeModelConfig(b[key as ModelProvider], key as ModelProvider);
    if (
      left.baseUrl.trim() !== right.baseUrl.trim() ||
      left.apiKey.trim() !== right.apiKey.trim() ||
      left.model.trim() !== right.model.trim()
    ) {
      return false;
    }
  }
  return true;
}

export function modelConfigEqual(a: ModelConfig, b: ModelConfig): boolean {
  const left = normalizeModelConfig(a);
  const right = normalizeModelConfig(b);
  return (
    (left.provider ?? "openaiCompatible") === (right.provider ?? "openaiCompatible") &&
    left.baseUrl.trim() === right.baseUrl.trim() &&
    left.apiKey.trim() === right.apiKey.trim() &&
    left.model.trim() === right.model.trim()
  );
}
