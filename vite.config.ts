import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";
import { bootSplashPlugin } from "./vite.bootSplash";

export default defineConfig({
  // Tauri 生产环境用自定义协议加载页面，必须用相对路径，否则 /assets/... 会 404 导致白屏
  base: "./",
  plugins: [react(), bootSplashPlugin()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) return;
          if (id.includes("@tiptap")) return "tiptap";
          if (id.includes("katex")) return "katex";
          if (id.includes("react-markdown") || id.includes("remark-") || id.includes("rehype-")) return "markdown";
          if (id.includes("lucide-react")) return "icons";
          return "vendor";
        }
      }
    },
    chunkSizeWarningLimit: 900
  },
  /** 应用静态资源统一走 src/assets 与 Vite 打包，不使用 public 目录 */
  publicDir: false,
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true
  },
  envPrefix: ["VITE_", "TAURI_"],
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"]
  }
});
