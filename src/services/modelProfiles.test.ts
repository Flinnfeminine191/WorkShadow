import { describe, expect, it } from "vitest";
import {
  emptyModelConfig,
  isProfileMeaningfullyStored,
  loadModelSlot,
  normalizeModelProfiles,
  switchModelProviderProfile,
  upsertModelProfile
} from "./modelProfiles";

describe("loadModelSlot", () => {
  it("migrates legacy flat config", () => {
    const slot = loadModelSlot({
      baseUrl: "https://api.deepseek.com/v1",
      apiKey: "sk-test",
      model: "deepseek-chat"
    });
    expect(slot.active.model).toBe("deepseek-chat");
    expect(slot.profiles.deepseek?.apiKey).toBe("sk-test");
  });

  it("migrates nested activeProvider + configs", () => {
    const slot = loadModelSlot({
      activeProvider: "aliyun",
      configs: {
        deepseek: { baseUrl: "https://api.deepseek.com/v1", apiKey: "a", model: "deepseek-chat" },
        aliyun: {
          baseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1",
          apiKey: "b",
          model: "qwen-plus"
        }
      }
    });
    expect(slot.active.model).toBe("qwen-plus");
    expect(slot.profiles.deepseek?.apiKey).toBe("a");
  });
});

describe("switchModelProviderProfile", () => {
  it("does not persist preset-only browse into profiles", () => {
    const deepseek = {
      provider: "deepseek" as const,
      baseUrl: "https://api.deepseek.com/v1",
      apiKey: "sk-x",
      model: "deepseek-chat"
    };
    const profiles = upsertModelProfile({}, deepseek);
    const { config, profiles: afterBrowse } = switchModelProviderProfile(profiles, deepseek, "aliyun");
    expect(config.provider).toBe("aliyun");
    expect(afterBrowse.aliyun).toBeUndefined();
    expect(afterBrowse.deepseek?.apiKey).toBe("sk-x");
  });

  it("keeps both provider entries", () => {
    let profiles = {};
    const deepseek = upsertModelProfile(profiles, {
      provider: "deepseek",
      baseUrl: "https://api.deepseek.com/v1",
      apiKey: "d",
      model: "deepseek-chat"
    }).deepseek!;
    profiles = upsertModelProfile(profiles, deepseek);
    const current = deepseek;
    const { config, profiles: next } = switchModelProviderProfile(profiles, current, "aliyun");
    const withAliyun = upsertModelProfile(next, {
      ...config,
      provider: "aliyun",
      apiKey: "a",
      model: "qwen-plus"
    });
    const back = switchModelProviderProfile(withAliyun, withAliyun.aliyun!, "deepseek");
    expect(back.config.apiKey).toBe("d");
    expect(back.profiles.aliyun?.model).toBe("qwen-plus");
  });
});

describe("isProfileMeaningfullyStored", () => {
  it("requires api key for remote providers", () => {
    expect(
      isProfileMeaningfullyStored({
        provider: "deepseek",
        baseUrl: "https://api.deepseek.com/v1",
        apiKey: "",
        model: "deepseek-chat"
      })
    ).toBe(false);
    expect(
      isProfileMeaningfullyStored({
        provider: "deepseek",
        baseUrl: "https://api.deepseek.com/v1",
        apiKey: "sk-1",
        model: "deepseek-chat"
      })
    ).toBe(true);
  });
});

describe("normalizeModelProfiles", () => {
  it("uses active when profiles missing", () => {
    const active = emptyModelConfig("openai");
    active.apiKey = "k";
    const profiles = normalizeModelProfiles(undefined, active);
    expect(profiles.openai?.apiKey).toBe("k");
  });
});
