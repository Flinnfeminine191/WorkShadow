import fs from "node:fs";
import path from "node:path";
import type { Plugin } from "vite";

const ASSETS_DIR = path.resolve("src/assets");
const LIGHT_FILE = "AppLightSmall.png";
const DARK_FILE = "AppDarkSmall.png";
const INJECT_MARKER = "/*__WORKSHADOW_BOOT_DATA__*/";
const LIGHT_SRC_MARKER = "__WORKSHADOW_BOOT_LIGHT_SRC__";

function readBootDataUris(): { light: string; dark: string } {
  const lightBuf = fs.readFileSync(path.join(ASSETS_DIR, LIGHT_FILE));
  const darkBuf = fs.readFileSync(path.join(ASSETS_DIR, DARK_FILE));
  return {
    light: `data:image/png;base64,${lightBuf.toString("base64")}`,
    dark: `data:image/png;base64,${darkBuf.toString("base64")}`
  };
}

/**
 * 构建/开发时把启动图以 data URI 写入 index.html，首屏零网络请求。
 * （不再使用 dist/boot/ 或 /boot/ 路径。）
 */
export function bootSplashPlugin(): Plugin {
  let cached: { light: string; dark: string } | null = null;

  function getData() {
    cached ??= readBootDataUris();
    return cached;
  }

  return {
    name: "workshadow-boot-splash",
    transformIndexHtml(html) {
      const { light, dark } = getData();
      const dataJson = JSON.stringify({ light, dark });
      return html
        .replace(INJECT_MARKER, `window.__WORKSHADOW_BOOT_DATA__=${dataJson};`)
        .replaceAll(LIGHT_SRC_MARKER, light);
    }
  };
}
