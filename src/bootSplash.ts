const BOOT_ID = "workshadow-boot";
const BOOT_LOGO_ID = "workshadow-boot-logo";
export const BOOT_THEME_KEY = "workshadow.bootTheme";

const MIN_SPLASH_MS = 80;

export type BootTheme = "light" | "dark";

type BootLogoData = { light: string; dark: string };

declare global {
  interface Window {
    __WORKSHADOW_BOOT_DATA__?: BootLogoData;
    __WORKSHADOW_BOOT_LOGO__?: string;
  }
}

let splashShownAt = typeof performance !== "undefined" ? performance.now() : 0;

/** 供 index.html 内联脚本与启动层使用，尽量与上次会话主题一致。 */
export function resolveBootTheme(): BootTheme {
  try {
    const stored = localStorage.getItem(BOOT_THEME_KEY);
    if (stored === "dark" || stored === "light") return stored;
    const raw = localStorage.getItem("workshadow.state");
    if (raw) {
      const theme = (JSON.parse(raw) as { settings?: { theme?: string } })?.settings?.theme;
      if (theme === "dark" || theme === "light") return theme;
    }
  } catch {
    /* ignore */
  }
  if (typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches) {
    return "dark";
  }
  return "light";
}

export function persistBootTheme(theme: BootTheme) {
  try {
    localStorage.setItem(BOOT_THEME_KEY, theme);
  } catch {
    /* ignore */
  }
  document.documentElement.setAttribute("data-boot-theme", theme);
}

function bootLogoSrc(theme: BootTheme): string | null {
  const data = window.__WORKSHADOW_BOOT_DATA__;
  if (data) return theme === "dark" ? data.dark : data.light;
  return window.__WORKSHADOW_BOOT_LOGO__ ?? null;
}

/** 按当前主题刷新启动图（data URI，无额外网络请求）。 */
export function applyBootSplashLogos() {
  const theme = resolveBootTheme();
  document.documentElement.setAttribute("data-boot-theme", theme);
  const img = document.getElementById(BOOT_LOGO_ID) as HTMLImageElement | null;
  const src = bootLogoSrc(theme);
  if (!img || !src) return;
  if (img.src !== src) img.src = src;
  img.alt = "WorkShadow";
}

/** 移除启动层；data URI 通常已解码，仅保留极短最短展示时间。 */
export function dismissBootSplash() {
  const remove = () => {
    document.getElementById(BOOT_ID)?.remove();
    document.documentElement.classList.add("workshadow-ready");
  };

  const waitMinThen = (fn: () => void) => {
    const elapsed = performance.now() - splashShownAt;
    const delay = Math.max(0, MIN_SPLASH_MS - elapsed);
    window.setTimeout(fn, delay);
  };

  const img = document.getElementById(BOOT_LOGO_ID) as HTMLImageElement | null;
  if (!img?.src) {
    waitMinThen(remove);
    return;
  }

  const instant = img.src.startsWith("data:");
  if (instant || (img.complete && img.naturalWidth > 0)) {
    waitMinThen(remove);
    return;
  }

  const done = () => waitMinThen(remove);
  img.addEventListener("load", done, { once: true });
  img.addEventListener("error", done, { once: true });
  window.setTimeout(done, 3000);
}
