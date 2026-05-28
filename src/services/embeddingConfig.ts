import type { TFunction } from "i18next";
import type { AppSettings, ConfirmOptions, ModelConfig } from "../types";
import { isModelConfigReady } from "./openaiCompat";
import { modelConfigEqual } from "./modelProfiles";
import { testEmbeddingConfig } from "./modelTest";

export function normalizeEmbeddingConfig(config: ModelConfig): ModelConfig {
  return {
    provider: config.provider,
    baseUrl: config.baseUrl.trim(),
    apiKey: config.apiKey.trim(),
    model: config.model.trim()
  };
}

export function isEmbeddingConfigComplete(config: ModelConfig): boolean {
  return isModelConfigReady(normalizeEmbeddingConfig(config));
}

export function embeddingSettingsEqual(a: AppSettings, b: AppSettings): boolean {
  return (
    modelConfigEqual(a.embedding, b.embedding) &&
    JSON.stringify(a.embeddingProfiles ?? {}) === JSON.stringify(b.embeddingProfiles ?? {})
  );
}

export type EmbeddingCommitResult =
  | { applied: true; needsVectorRebuild: boolean }
  | { applied: false; reason: "unchanged" | "cancelled" | "testFailed" };

export async function commitEmbeddingConfigChange(params: {
  previous: Pick<AppSettings, "embedding" | "embeddingProfiles">;
  next: Pick<AppSettings, "embedding" | "embeddingProfiles">;
  confirm: (options: ConfirmOptions) => Promise<boolean>;
  t: TFunction;
  onTestFailed?: (message: string) => void;
}): Promise<EmbeddingCommitResult> {
  const { previous, next, confirm, t, onTestFailed } = params;
  const prevActive = normalizeEmbeddingConfig(previous.embedding);
  const nextActive = normalizeEmbeddingConfig(next.embedding);

  if (modelConfigEqual(prevActive, nextActive) && JSON.stringify(previous.embeddingProfiles) === JSON.stringify(next.embeddingProfiles)) {
    return { applied: false, reason: "unchanged" };
  }

  const prevComplete = isEmbeddingConfigComplete(prevActive);
  const nextComplete = isEmbeddingConfigComplete(nextActive);
  const modelChanged = prevActive.model !== nextActive.model;
  const connectionChanged =
    (prevActive.provider ?? "openaiCompatible") !== (nextActive.provider ?? "openaiCompatible") ||
    prevActive.baseUrl !== nextActive.baseUrl ||
    prevActive.apiKey !== nextActive.apiKey ||
    modelChanged;

  if (modelChanged && prevComplete && nextActive.model !== prevActive.model) {
    const ok = await confirm({
      title: t("embeddingModelChangeTitle"),
      message: t("embeddingModelChangeMessage")
    });
    if (!ok) return { applied: false, reason: "cancelled" };
  }

  if (connectionChanged && nextComplete) {
    try {
      await testEmbeddingConfig(nextActive);
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      onTestFailed?.(message);
      return { applied: false, reason: "testFailed" };
    }
  }

  const needsVectorRebuild = Boolean(modelChanged && prevComplete && nextComplete && nextActive.model !== prevActive.model);
  return { applied: true, needsVectorRebuild };
}
