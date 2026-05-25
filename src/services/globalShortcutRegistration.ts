import { register, unregisterAll } from "@tauri-apps/plugin-global-shortcut";
import type { ShortcutBinding } from "../types";
import { bindingToTauriGlobalShortcut } from "./shortcuts";
import { isTauriRuntime } from "./storage";

/**
 * 串行执行 unregister/register，避免：
 * - React Strict Mode 或 effect 重跑时 cleanup 与下一次 register 并发；
 * - `void clearGlobalShortcuts()` 未 await 与 `applyGlobalNewLogShortcut` 交错导致注册失败并反复弹 Toast。
 */
let globalShortcutOpChain: Promise<void> = Promise.resolve();

function enqueueGlobalShortcutOp(op: () => Promise<void>): Promise<void> {
  const next = globalShortcutOpChain.then(() => op());
  globalShortcutOpChain = next.catch(() => {});
  return next;
}

export async function applyGlobalNewLogShortcut(binding: ShortcutBinding, onPressed: () => void): Promise<void> {
  if (!isTauriRuntime()) return;
  await enqueueGlobalShortcutOp(async () => {
    const accelerator = bindingToTauriGlobalShortcut(binding);
    await unregisterAll();
    if (!accelerator) return;
    await register(accelerator, (e) => {
      if (e.state !== "Pressed") return;
      onPressed();
    });
  });
}

export async function clearGlobalShortcuts(): Promise<void> {
  if (!isTauriRuntime()) return;
  await enqueueGlobalShortcutOp(() => unregisterAll());
}
