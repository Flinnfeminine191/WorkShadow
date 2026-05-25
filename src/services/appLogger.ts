import { invoke } from "@tauri-apps/api/core";
import { formatLocalRFC3339 } from "./dateTime";
import { isTauriRuntime } from "./storage";
import { redactForDiagnostics } from "./errorReporting";

export type AppLogLevel = "debug" | "info" | "warn" | "error";

const DEV_MEMORY_MAX = 500;
const devMemory: string[] = [];

function pushDevMemory(line: string) {
  devMemory.push(line);
  if (devMemory.length > DEV_MEMORY_MAX) {
    devMemory.splice(0, devMemory.length - DEV_MEMORY_MAX);
  }
}

function formatLine(level: AppLogLevel, target: string, message: string, fields?: Record<string, unknown>): string {
  const ts = formatLocalRFC3339();
  const fieldsPart =
    fields && Object.keys(fields).length > 0
      ? ` ${redactForDiagnostics(JSON.stringify(fields))}`
      : "";
  return `${ts} ${level.toUpperCase().padEnd(5)} ${target} ${redactForDiagnostics(message)}${fieldsPart}`;
}

export function getDevMemoryLogs(): string[] {
  return [...devMemory];
}

export function clearDevMemoryLogs() {
  devMemory.length = 0;
}

export async function appLog(
  level: AppLogLevel,
  target: string,
  message: string,
  fields?: Record<string, unknown>
): Promise<void> {
  const line = formatLine(level, target, message, fields);
  pushDevMemory(line);
  if (import.meta.env.DEV) {
    const fn = level === "error" ? console.error : level === "warn" ? console.warn : console.log;
    fn(`[${target}]`, message, fields ?? "");
  }
  if (!isTauriRuntime()) return;
  try {
    await invoke("app_log_write", {
      level,
      target,
      message: redactForDiagnostics(message),
      fields: fields ?? null
    });
  } catch {
    /* avoid recursive failure */
  }
}

export interface AppLogFileInfo {
  name: string;
  path: string;
  sizeBytes: number;
  modifiedAt: string;
}

export interface AppLogPolicy {
  maxFileBytes: number;
  retentionDays: number;
  maxLogFiles: number;
  rotation: string;
}

export async function listAppLogFiles(): Promise<AppLogFileInfo[]> {
  if (!isTauriRuntime()) {
    return devMemory.length
      ? [
          {
            name: "browser-dev.log",
            path: "",
            sizeBytes: devMemory.join("\n").length,
            modifiedAt: formatLocalRFC3339()
          }
        ]
      : [];
  }
  return invoke<AppLogFileInfo[]>("app_log_list_files");
}

export async function readAppLogFile(fileName: string, maxLines = 2000): Promise<string> {
  if (!isTauriRuntime()) {
    if (fileName === "browser-dev.log") return devMemory.join("\n");
    return "";
  }
  return invoke<string>("app_log_read_file", { fileName, maxLines });
}

export async function getAppLogDirectory(): Promise<string> {
  if (!isTauriRuntime()) return "";
  return invoke<string>("app_log_get_directory");
}

export async function getAppLogPolicy(): Promise<AppLogPolicy> {
  if (!isTauriRuntime()) {
    return {
      maxFileBytes: 0,
      retentionDays: 0,
      maxLogFiles: DEV_MEMORY_MAX,
      rotation: "in-memory (browser dev)"
    };
  }
  return invoke<AppLogPolicy>("app_log_get_policy");
}

export async function openAppLogDirectory(): Promise<void> {
  if (!isTauriRuntime()) return;
  await invoke("app_log_open_directory");
}

export async function getAppDbDirectory(): Promise<string> {
  if (!isTauriRuntime()) return "";
  return invoke<string>("app_db_get_directory");
}

export async function openAppDbDirectory(): Promise<void> {
  if (!isTauriRuntime()) return;
  await invoke("app_db_open_directory");
}
