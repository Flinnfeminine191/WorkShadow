import type { TFunction } from "i18next";
import { describe, expect, it, vi } from "vitest";

const mockT = ((k: string) => k) as TFunction;
import { emptyModelConfig, upsertModelProfile } from "./modelProfiles";
import { commitEmbeddingConfigChange, isEmbeddingConfigComplete } from "./embeddingConfig";

vi.mock("./modelTest", () => ({
  testEmbeddingConfig: vi.fn().mockResolvedValue("1536")
}));

const emptyProfiles = {};

describe("embeddingConfig", () => {
  it("detects complete config", () => {
    expect(isEmbeddingConfigComplete({ baseUrl: "https://x", apiKey: "k", model: "m" })).toBe(true);
    expect(isEmbeddingConfigComplete({ baseUrl: "", apiKey: "k", model: "m" })).toBe(false);
    expect(
      isEmbeddingConfigComplete({
        baseUrl: "http://127.0.0.1:11434/v1",
        apiKey: "",
        model: "nomic-embed-text",
        provider: "ollama"
      })
    ).toBe(true);
  });

  it("skips unchanged commit", async () => {
    const embedding = { ...emptyModelConfig(), baseUrl: "https://x", apiKey: "k", model: "m" };
    const payload = { embedding, embeddingProfiles: emptyProfiles };
    const result = await commitEmbeddingConfigChange({
      previous: payload,
      next: payload,
      confirm: vi.fn(),
      t: mockT
    });
    expect(result).toEqual({ applied: false, reason: "unchanged" });
  });

  it("requires confirm when model name changes with prior full config", async () => {
    const confirm = vi.fn().mockResolvedValue(false);
    const prev = {
      embedding: { ...emptyModelConfig(), baseUrl: "https://x", apiKey: "k", model: "old" },
      embeddingProfiles: emptyProfiles
    };
    const next = {
      embedding: { ...emptyModelConfig(), baseUrl: "https://x", apiKey: "k", model: "new" },
      embeddingProfiles: emptyProfiles
    };
    const result = await commitEmbeddingConfigChange({
      previous: prev,
      next,
      confirm,
      t: mockT
    });
    expect(confirm).toHaveBeenCalled();
    expect(result).toEqual({ applied: false, reason: "cancelled" });
  });

  it("applies url change without rebuild flag when model unchanged", async () => {
    const prev = {
      embedding: { ...emptyModelConfig(), baseUrl: "https://a", apiKey: "k", model: "m" },
      embeddingProfiles: emptyProfiles
    };
    const next = {
      embedding: { ...emptyModelConfig(), baseUrl: "https://b", apiKey: "k", model: "m" },
      embeddingProfiles: emptyProfiles
    };
    const result = await commitEmbeddingConfigChange({
      previous: prev,
      next,
      confirm: vi.fn(),
      t: mockT
    });
    expect(result).toEqual({ applied: true, needsVectorRebuild: false });
  });

  it("flags vector rebuild after confirmed model change", async () => {
    const prev = {
      embedding: { ...emptyModelConfig(), baseUrl: "https://x", apiKey: "k", model: "old" },
      embeddingProfiles: emptyProfiles
    };
    const next = {
      embedding: { ...emptyModelConfig(), baseUrl: "https://x", apiKey: "k", model: "new" },
      embeddingProfiles: emptyProfiles
    };
    const result = await commitEmbeddingConfigChange({
      previous: prev,
      next,
      confirm: vi.fn().mockResolvedValue(true),
      t: mockT
    });
    expect(result).toEqual({ applied: true, needsVectorRebuild: true });
  });

  it("stores per-provider drafts separately", () => {
    const profiles = upsertModelProfile(emptyProfiles, {
      provider: "deepseek",
      baseUrl: "https://api.deepseek.com/v1",
      apiKey: "d",
      model: "deepseek-chat"
    });
    const withAliyun = upsertModelProfile(profiles, {
      provider: "aliyun",
      baseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1",
      apiKey: "a",
      model: "qwen-plus"
    });
    expect(withAliyun.deepseek?.apiKey).toBe("d");
    expect(withAliyun.aliyun?.model).toBe("qwen-plus");
  });
});
