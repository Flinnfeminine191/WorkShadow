import { useMemo, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import {
  MODEL_PROVIDER_PRESETS,
  getModelProviderPreset,
  isApiKeyOptionalForProvider,
  type ModelProvider
} from "../services/modelProviders";
import { switchModelProviderProfile, upsertModelProfile } from "../services/modelProfiles";
import type { ModelConfig, ModelProfiles } from "../types";

type ModelTestState = { status: "idle" } | { status: "running" } | { status: "ok"; message: string } | { status: "fail"; message: string };

interface Props {
  value: ModelConfig;
  profiles: ModelProfiles;
  onChange: (value: ModelConfig, profiles: ModelProfiles) => void;
  onTest: (config: ModelConfig) => Promise<unknown>;
  testSuccessMessage: string;
  disabled?: boolean;
  /** 嵌入：仅展示支持 embedding 的预设 */
  embeddingOnly?: boolean;
  hideTestButton?: boolean;
  extraActions?: ReactNode;
}

export function ModelConfigFields({
  value,
  profiles,
  onChange,
  onTest,
  testSuccessMessage,
  disabled = false,
  embeddingOnly = false,
  hideTestButton = false,
  extraActions
}: Props) {
  const { t } = useTranslation();
  const [test, setTest] = useState<ModelTestState>({ status: "idle" });
  const providerId = value.provider ?? "openaiCompatible";
  const presets = useMemo(
    () => (embeddingOnly ? MODEL_PROVIDER_PRESETS.filter((p) => p.supportsEmbedding) : MODEL_PROVIDER_PRESETS),
    [embeddingOnly]
  );
  const activePreset = useMemo(() => getModelProviderPreset(providerId), [providerId]);
  const apiKeyOptional = isApiKeyOptionalForProvider(providerId, value.baseUrl);

  function emit(next: ModelConfig, nextProfiles: ModelProfiles) {
    onChange(next, nextProfiles);
    setTest({ status: "idle" });
  }

  function updateCurrent(patch: Partial<ModelConfig>) {
    const next = { ...value, ...patch, provider: providerId };
    emit(next, upsertModelProfile(profiles, next));
  }

  function applyProvider(id: ModelProvider) {
    const { config, profiles: nextProfiles } = switchModelProviderProfile(profiles, value, id);
    emit(config, nextProfiles);
  }

  async function runTest() {
    setTest({ status: "running" });
    try {
      await onTest(value);
      setTest({ status: "ok", message: testSuccessMessage });
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      setTest({ status: "fail", message: t("modelTestFailed", { message }) });
    }
  }

  const hintKey = activePreset.hintKey;

  return (
    <div className="settings-model-block">
      <label className="settings-field">
        <span className="settings-field-label">{t("modelProviderLabel")}</span>
        <select
          className="settings-model-provider-select"
          value={providerId}
          disabled={disabled}
          onChange={(event) => applyProvider(event.target.value as ModelProvider)}
        >
          {presets.map((preset) => (
            <option key={preset.id} value={preset.id}>
              {t(`modelProvider.${preset.labelKey}`)}
            </option>
          ))}
        </select>
      </label>
      {hintKey ? (
        <p className="settings-model-provider-hint muted">{t(`modelProvider.${hintKey}`)}</p>
      ) : null}
      <p className="settings-model-provider-hint muted">{t("modelProvider.perProviderHint")}</p>
      <label className="settings-field">
        <span className="settings-field-label">{t("baseUrl")}</span>
        <input
          value={value.baseUrl}
          disabled={disabled}
          placeholder={activePreset.baseUrl || t("modelProvider.baseUrlPlaceholder")}
          onChange={(event) => updateCurrent({ baseUrl: event.target.value })}
        />
      </label>
      <label className="settings-field">
        <span className="settings-field-label">
          {t("apiKey")}
          {apiKeyOptional ? <span className="settings-field-optional"> ({t("modelProvider.apiKeyOptional")})</span> : null}
        </span>
        <input
          type="password"
          value={value.apiKey}
          disabled={disabled}
          placeholder={apiKeyOptional ? t("modelProvider.apiKeyOptionalPlaceholder") : undefined}
          onChange={(event) => updateCurrent({ apiKey: event.target.value })}
        />
      </label>
      <label className="settings-field">
        <span className="settings-field-label">{t("modelName")}</span>
        <input
          value={value.model}
          disabled={disabled}
          placeholder={activePreset.defaultModel}
          onChange={(event) => updateCurrent({ model: event.target.value })}
        />
      </label>
      {extraActions}
      {!hideTestButton ? (
        <div className="settings-model-test">
          <button
            type="button"
            className="settings-model-test-btn small"
            disabled={disabled || test.status === "running"}
            onClick={() => void runTest()}
          >
            {test.status === "running" ? t("modelTestRunning") : t("modelTestConnection")}
          </button>
          {test.status === "ok" ? <p className="settings-model-test-msg settings-model-test-msg--ok">{test.message}</p> : null}
          {test.status === "fail" ? <p className="settings-model-test-msg settings-model-test-msg--fail">{test.message}</p> : null}
        </div>
      ) : null}
    </div>
  );
}
