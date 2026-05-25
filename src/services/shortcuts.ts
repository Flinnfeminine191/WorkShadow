import type { ShortcutBinding, ShortcutMap, ShortcutMod } from "../types";

const MODIFIER_CODES = new Set([
  "MetaLeft",
  "MetaRight",
  "ControlLeft",
  "ControlRight",
  "ShiftLeft",
  "ShiftRight",
  "AltLeft",
  "AltRight",
  "OSLeft",
  "OSRight"
]);

export const defaultShortcutMap: ShortcutMap = {
  newLog: { code: "KeyN", mod: "ctrlOrMeta", shift: false, alt: false },
  /** 默认与「应用内新建」区分，避免双注册时重复触发 */
  globalNewLog: { code: "KeyN", mod: "ctrlOrMeta", shift: true, alt: false },
  lightboxClose: { code: "Escape", mod: "none", shift: false, alt: false },
  lightboxPrev: { code: "ArrowLeft", mod: "none", shift: false, alt: false },
  lightboxNext: { code: "ArrowRight", mod: "none", shift: false, alt: false },
  treeMenuClose: { code: "Escape", mod: "none", shift: false, alt: false }
};

export function normalizeShortcutBinding(raw: Partial<ShortcutBinding> | undefined, fallback: ShortcutBinding): ShortcutBinding {
  if (!raw || typeof raw.code !== "string" || !raw.code.trim()) return { ...fallback };
  const mod = (["none", "ctrl", "meta", "ctrlOrMeta"] as const).includes(raw.mod as ShortcutMod) ? (raw.mod as ShortcutMod) : fallback.mod;
  return {
    code: raw.code.trim(),
    mod,
    shift: Boolean(raw.shift),
    alt: Boolean(raw.alt)
  };
}

export function mergeShortcutMap(raw: Partial<ShortcutMap> | undefined): ShortcutMap {
  return {
    newLog: normalizeShortcutBinding(raw?.newLog, defaultShortcutMap.newLog),
    globalNewLog: normalizeShortcutBinding(raw?.globalNewLog, defaultShortcutMap.globalNewLog),
    lightboxClose: normalizeShortcutBinding(raw?.lightboxClose, defaultShortcutMap.lightboxClose),
    lightboxPrev: normalizeShortcutBinding(raw?.lightboxPrev, defaultShortcutMap.lightboxPrev),
    lightboxNext: normalizeShortcutBinding(raw?.lightboxNext, defaultShortcutMap.lightboxNext),
    treeMenuClose: normalizeShortcutBinding(raw?.treeMenuClose, defaultShortcutMap.treeMenuClose)
  };
}

export function matchesShortcut(event: KeyboardEvent, binding: ShortcutBinding): boolean {
  if (event.code !== binding.code) return false;
  if (event.shiftKey !== binding.shift) return false;
  if (event.altKey !== binding.alt) return false;
  const hasCtrl = event.ctrlKey;
  const hasMeta = event.metaKey;
  if (binding.mod === "none") return !hasCtrl && !hasMeta;
  if (binding.mod === "ctrl") return hasCtrl && !hasMeta;
  if (binding.mod === "meta") return hasMeta && !hasCtrl;
  if (binding.mod === "ctrlOrMeta") return hasCtrl || hasMeta;
  return false;
}

/** 录制时：修饰键单独按下不生成绑定 */
export function bindingFromKeyboardEvent(event: KeyboardEvent): ShortcutBinding | null {
  if (MODIFIER_CODES.has(event.code)) return null;
  let mod: ShortcutMod = "none";
  if (event.ctrlKey && event.metaKey) mod = "ctrlOrMeta";
  else if (event.ctrlKey) mod = "ctrl";
  else if (event.metaKey) mod = "meta";
  return {
    code: event.code,
    mod,
    shift: event.shiftKey,
    alt: event.altKey
  };
}

function isApplePlatform() {
  return typeof navigator !== "undefined" && /Mac|iPhone|iPad|iPod/i.test(navigator.userAgent);
}

function codeToLabel(code: string): string {
  if (code === "Escape") return "Esc";
  if (code === "ArrowLeft") return "←";
  if (code === "ArrowRight") return "→";
  if (code === "ArrowUp") return "↑";
  if (code === "ArrowDown") return "↓";
  if (code === "Space") return "Space";
  if (code === "Backspace") return "⌫";
  if (code === "Tab") return "Tab";
  if (code === "Enter") return "Enter";
  if (code.startsWith("Key") && code.length === 4) return code.slice(3);
  if (code.startsWith("Digit")) return code.slice(5);
  return code;
}

/** 用于侧栏按钮等：拆成多段以便用 <kbd> 包裹 */
export function formatShortcutParts(binding: ShortcutBinding): string[] {
  const parts: string[] = [];
  const apple = isApplePlatform();
  if (binding.mod === "ctrlOrMeta") parts.push(apple ? "⌘" : "Ctrl");
  else if (binding.mod === "ctrl") parts.push("Ctrl");
  else if (binding.mod === "meta") parts.push(apple ? "⌘" : "Meta");
  if (binding.shift) parts.push("Shift");
  if (binding.alt) parts.push(apple ? "⌥" : "Alt");
  parts.push(codeToLabel(binding.code));
  return parts;
}

export function formatShortcutLabel(binding: ShortcutBinding): string {
  return formatShortcutParts(binding).join(" + ");
}

/** 用于 React effect 依赖：仅当按键组合实际变化时才变，避免 mergeShortcutMap 产生新对象引用导致重复注册 */
export function shortcutBindingFingerprint(binding: ShortcutBinding): string {
  return `${binding.mod}:${binding.code}:${binding.shift ? "S" : "-"}:${binding.alt ? "A" : "-"}`;
}

/** 新建日志类快捷键必须带 Ctrl/Meta，避免与正文输入冲突 */
export function isValidNewLogShortcut(binding: ShortcutBinding): boolean {
  return binding.mod === "ctrl" || binding.mod === "meta" || binding.mod === "ctrlOrMeta";
}

/** 系统级快捷键必须含 Ctrl / ⌘ / Ctrl+⌘ 之一，禁止裸字母键 */
export function isValidGlobalNewLogShortcut(binding: ShortcutBinding): boolean {
  return binding.mod === "ctrl" || binding.mod === "meta" || binding.mod === "ctrlOrMeta";
}

function keyboardCodeToAcceleratorKey(code: string): string | null {
  if (code === "Space") return "Space";
  if (code === "Escape") return "Escape";
  if (code === "Tab") return "Tab";
  if (code === "Enter") return "Enter";
  if (code === "Backspace") return "Backspace";
  if (code === "Minus") return "-";
  if (code === "Equal") return "=";
  if (code === "BracketLeft") return "[";
  if (code === "BracketRight") return "]";
  if (code === "Semicolon") return ";";
  if (code === "Quote") return "'";
  if (code === "Backquote") return "`";
  if (code === "Backslash") return "\\";
  if (code === "Comma") return ",";
  if (code === "Period") return ".";
  if (code === "Slash") return "/";
  if (code.startsWith("Key") && code.length === 4) return code.slice(3);
  if (code.startsWith("Digit")) return code.slice(5);
  if (code.startsWith("F") && /^F\d{1,2}$/.test(code)) return code;
  return null;
}

/**
 * 转为 Tauri global-shortcut 使用的加速器字符串（如 CommandOrControl+Shift+N）。
 * 无法映射的键返回 null。
 */
export function bindingToTauriGlobalShortcut(binding: ShortcutBinding): string | null {
  if (!isValidGlobalNewLogShortcut(binding)) return null;
  const key = keyboardCodeToAcceleratorKey(binding.code);
  if (!key) return null;
  const parts: string[] = [];
  if (binding.mod === "ctrlOrMeta") parts.push("CommandOrControl");
  else if (binding.mod === "ctrl") parts.push("Ctrl");
  else if (binding.mod === "meta") parts.push("Command");
  if (binding.shift) parts.push("Shift");
  if (binding.alt) parts.push("Alt");
  parts.push(key);
  return parts.join("+");
}

export type ShortcutActionId = keyof ShortcutMap;
