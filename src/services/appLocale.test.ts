import { describe, expect, it } from "vitest";
import { isLocaleZhFromSettings, resolveEffectiveLanguage } from "./appLocale";

describe("appLocale", () => {
  it("uses explicit zh/en from settings", () => {
    expect(resolveEffectiveLanguage("en")).toBe("en");
    expect(resolveEffectiveLanguage("zh")).toBe("zh");
    expect(isLocaleZhFromSettings({ language: "en" })).toBe(false);
    expect(isLocaleZhFromSettings({ language: "zh" })).toBe(true);
  });
});
