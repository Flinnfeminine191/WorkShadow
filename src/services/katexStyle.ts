let katexStylesLoading: Promise<void> | null = null;

/** 按需加载 KaTeX 样式，避免阻塞首屏。 */
export function ensureKatexStyles(): Promise<void> {
  if (!katexStylesLoading) {
    katexStylesLoading = import("katex/dist/katex.min.css").then(() => undefined);
  }
  return katexStylesLoading;
}
