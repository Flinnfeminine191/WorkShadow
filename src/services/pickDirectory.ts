import { open } from "@tauri-apps/plugin-dialog";
import { isTauriRuntime } from "./storage";

/** 去掉 Windows 扩展路径前缀，便于在设置里显示 */
export function normalizePickedPath(path: string): string {
  if (path.startsWith("\\\\?\\UNC\\")) return `\\\\${path.slice(8)}`;
  if (path.startsWith("\\\\?\\")) return path.slice(4);
  return path;
}

export async function pickDirectory(options?: { defaultPath?: string; title?: string }): Promise<string | null> {
  if (!isTauriRuntime()) return null;
  const selected = await open({
    directory: true,
    multiple: false,
    defaultPath: options?.defaultPath?.trim() || undefined,
    title: options?.title
  });
  if (selected === null) return null;
  const raw = Array.isArray(selected) ? (selected[0] ?? null) : selected;
  return raw ? normalizePickedPath(raw) : null;
}
