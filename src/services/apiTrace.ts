import { appLog } from "./appLogger";
import type { SearchResult } from "../types";

/** 与设置里「开发者工具」一致：仅 Vite 开发构建为 true */
export function isDevVerboseApiLogging(): boolean {
  return import.meta.env.DEV;
}

function llmLogTarget(purpose: string): string {
  if (purpose === "log_qa" || purpose === "log_summary") return purpose;
  return "llm";
}

/** 生产环境：记录用户操作（不含完整提示词与模型原文） */
export async function logUserAction(target: string, action: string, fields?: Record<string, unknown>): Promise<void> {
  if (isDevVerboseApiLogging()) return;
  await appLog("info", target, action, fields);
}

/** 开发环境：记录 LLM 请求全文（info 级别，target 按场景区分） */
export async function logLlmRequest(purpose: string, system: string, user: string, model: string): Promise<void> {
  if (!isDevVerboseApiLogging()) return;
  await appLog("info", llmLogTarget(purpose), `llm_request ${purpose}`, { model, system, user });
}

/** 开发环境：记录 LLM 响应全文 */
export async function logLlmResponse(purpose: string, response: string, model: string): Promise<void> {
  if (!isDevVerboseApiLogging()) return;
  await appLog("info", llmLogTarget(purpose), `llm_response ${purpose}`, { model, response });
}

/** 开发环境：记录 Embedding 请求与响应（向量以 JSON 数组记录） */
export async function logEmbeddingExchange(
  purpose: string,
  model: string,
  inputs: string[],
  vectors: number[][]
): Promise<void> {
  if (!isDevVerboseApiLogging()) return;
  await appLog("info", "embedding", purpose, {
    model,
    inputs,
    vectors,
    batchSize: inputs.length,
    dimensions: vectors[0]?.length ?? 0
  });
}

export function serializeSearchResultsForLog(results: SearchResult[], verbose: boolean) {
  return results.map((r) => ({
    logId: r.logId,
    title: r.node?.title,
    parentPath: r.parentPath,
    score: r.score,
    matchCount: r.matchCount,
    hits: r.hits.map((h) => ({
      chunkId: h.chunk.id,
      position: h.chunk.position,
      score: h.chunk.score,
      matchKind: h.matchKind,
      ...(verbose ? { text: h.chunk.text } : { textChars: h.chunk.text.length })
    }))
  }));
}

/** 工作台「日志问答」全流程应用日志 */
export async function traceLogQa(phase: string, fields: Record<string, unknown>): Promise<void> {
  if (isDevVerboseApiLogging()) {
    await appLog("info", "log_qa", phase, fields);
    return;
  }
  const brief: Record<string, unknown> = { phase };
  if (phase === "ask_start" && typeof fields.questionLength === "number") {
    brief.questionLength = fields.questionLength;
  } else if (phase === "rag_done") {
    if (typeof fields.resultCount === "number") brief.resultCount = fields.resultCount;
    if (Array.isArray(fields.logIds)) brief.logIds = fields.logIds;
  } else if (phase === "ask_done") {
    if (typeof fields.answerChars === "number") brief.answerChars = fields.answerChars;
    if (typeof fields.sourceCount === "number") brief.sourceCount = fields.sourceCount;
  } else if (phase === "ask_failed") {
    if (typeof fields.error === "string") brief.error = fields.error;
  }
  await appLog("info", "log_qa", phase, brief);
}

/** 工作台「日志总结」全流程应用日志 */
export async function traceLogSummary(phase: string, fields: Record<string, unknown>): Promise<void> {
  if (isDevVerboseApiLogging()) {
    await appLog("info", "log_summary", phase, fields);
    return;
  }
  const brief: Record<string, unknown> = { phase };
  if (phase === "summary_start" && typeof fields.logCount === "number") {
    brief.logCount = fields.logCount;
    if (Array.isArray(fields.logIds)) brief.logIds = fields.logIds;
  } else if (phase === "summary_done" && typeof fields.outputChars === "number") {
    brief.outputChars = fields.outputChars;
  } else if (phase === "summary_failed" && typeof fields.error === "string") {
    brief.error = fields.error;
  }
  await appLog("info", "log_summary", phase, brief);
}
