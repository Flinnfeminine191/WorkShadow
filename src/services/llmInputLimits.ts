import type { LogNode, MemoryEntry } from "../types";
import {
  buildLogSummaryUserMessage,
  buildMemoryContext,
  buildPreferencesInstructions,
  type ReportStylePreferences
} from "./insightsReports";
import { buildLogSummarySystem } from "./workshadowPrompt";

/** 单篇日志纳入总结时的正文上限（字符） */
export const LOG_SUMMARY_MAX_PER_LOG_CHARS = 4000;
/** 所选日志摘录总上限；超出则提示用户减量，不在此场景静默截断 */
export const LOG_SUMMARY_MAX_DIGEST_CHARS = 28000;
export const LOG_SUMMARY_MAX_MEMORY_CHARS = 4000;

export const LOG_QA_MAX_PER_HIT_CHARS = 3500;
/** 检索摘录总上限 */
export const LOG_QA_MAX_RAG_CHARS = 28000;
export const LOG_QA_MAX_MEMORY_CHARS = 4000;

/** system + user 合并字符上限（保守值，避免超出常见云端模型上下文） */
export const LLM_MAX_COMBINED_PROMPT_CHARS = 120_000;

export type LlmInputTooLongKind = "summary_logs" | "summary_prompt";

export class LlmInputTooLongError extends Error {
  readonly kind: LlmInputTooLongKind;

  constructor(kind: LlmInputTooLongKind) {
    super(kind);
    this.name = "LlmInputTooLongError";
    this.kind = kind;
  }
}

export function isLlmInputTooLongError(error: unknown): error is LlmInputTooLongError {
  return error instanceof LlmInputTooLongError;
}

function truncate(s: string, max: number) {
  if (s.length <= max) return s;
  return `${s.slice(0, max)}\n…(truncated)`;
}

/** 估算所选日志纳入总结时的摘录总字符数（含 per-log 上限，不含总上限截断） */
export function estimateLogsDigestChars(logs: LogNode[], maxPerLog: number): number {
  let used = 0;
  for (const log of logs) {
    const block = `## ${log.title}\n${truncate(log.markdown || "", maxPerLog)}\n`;
    used += block.length;
  }
  return used;
}

export function assertLogSummaryInputWithinLimit(
  logs: LogNode[],
  memory: MemoryEntry[],
  localeZh: boolean,
  preferences?: ReportStylePreferences
): void {
  const digestChars = estimateLogsDigestChars(logs, LOG_SUMMARY_MAX_PER_LOG_CHARS);
  if (digestChars > LOG_SUMMARY_MAX_DIGEST_CHARS) {
    throw new LlmInputTooLongError("summary_logs");
  }

  const mem = buildMemoryContext(memory, LOG_SUMMARY_MAX_MEMORY_CHARS);
  const prefBlock = buildPreferencesInstructions(preferences, localeZh);
  const system = buildLogSummarySystem(localeZh);
  const user = buildLogSummaryUserMessage(localeZh, {
    memory: mem,
    preferences: prefBlock,
    logDigest: "",
    logCount: logs.length
  });
  // 用真实 digest 再量一次（user 模板里 digest 占位为空，需加上摘录体积）
  if (system.length + user.length + digestChars > LLM_MAX_COMBINED_PROMPT_CHARS) {
    throw new LlmInputTooLongError("summary_prompt");
  }
}
