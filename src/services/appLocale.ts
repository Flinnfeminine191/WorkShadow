import type { AppSettings, Language } from "../types";

export type EffectiveLanguage = "zh" | "en";

/** 与设置面板、i18n 同步规则一致：system 跟随系统语言 */
export function resolveEffectiveLanguage(language: Language): EffectiveLanguage {
  if (language === "zh" || language === "en") return language;
  if (typeof navigator !== "undefined" && navigator.language.toLowerCase().startsWith("zh")) {
    return "zh";
  }
  return "en";
}

export function isLocaleZhFromSettings(settings: Pick<AppSettings, "language">): boolean {
  return resolveEffectiveLanguage(settings.language) === "zh";
}
