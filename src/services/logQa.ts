import type { AppSettings, LogNode, MemoryEntry, SearchHit, SearchResult } from "../types";
import { stripMarkupForSearchPreview } from "./rag";
import { streamChatText } from "./ai";
import {
  isDevVerboseApiLogging,
  serializeSearchResultsForLog,
  traceLogQa
} from "./apiTrace";
import { formatUnknownError } from "./errorReporting";
import { buildMemoryContext } from "./insightsReports";
import { LOG_QA_MAX_MEMORY_CHARS, LOG_QA_MAX_PER_HIT_CHARS, LOG_QA_MAX_RAG_CHARS } from "./llmInputLimits";
import type { WorkshadowRag } from "./rag";
import { compareByUpdatedAtDesc } from "./tree";
import { buildLogQaSystem } from "./workshadowPrompt";

function ragBlockChars(
  result: SearchResult,
  hit: SearchHit,
  maxPerHit: number,
  localeZh: boolean
): number {
  const pathLabel = localeZh ? "路径" : "Path";
  const title = result.node?.title?.trim() || result.parentPath || "(untitled)";
  const path = result.parentPath || title;
  const block = `### ${title}\n${pathLabel}: ${path}\n${truncate(hit.chunk.text, maxPerHit)}\n`;
  return block.length;
}

function hitRankScore(result: SearchResult, hit: SearchHit, hitIndex: number): number {
  return hit.chunk.score ?? result.score - hitIndex * 1e-6;
}

/**
 * 检索摘录超限时按相关度（embedding/混合分）从低到高丢弃，保留高分片段。
 */
export function trimSearchResultsForQaContext(
  results: SearchResult[],
  maxPerHit: number,
  maxTotal: number,
  localeZh: boolean
): SearchResult[] {
  type Picked = { result: SearchResult; hit: SearchHit; score: number; blockChars: number };
  const ranked: Picked[] = [];
  for (const result of results) {
    result.hits.forEach((hit, idx) => {
      ranked.push({
        result,
        hit,
        score: hitRankScore(result, hit, idx),
        blockChars: ragBlockChars(result, hit, maxPerHit, localeZh)
      });
    });
  }
  ranked.sort((a, b) => b.score - a.score);

  let used = 0;
  const picked: Picked[] = [];
  for (const item of ranked) {
    if (used + item.blockChars > maxTotal) break;
    picked.push(item);
    used += item.blockChars;
  }

  const byLog = new Map<string, { result: SearchResult; hits: SearchHit[] }>();
  for (const { result, hit } of picked) {
    const entry = byLog.get(result.logId) ?? { result, hits: [] };
    entry.hits.push(hit);
    byLog.set(result.logId, entry);
  }

  return [...byLog.values()]
    .map(({ result, hits }) => ({
      ...result,
      hits,
      matchCount: hits.length,
      score: Math.max(...hits.map((h, i) => hitRankScore(result, h, i)))
    }))
    .sort((a, b) => b.score - a.score);
}

export interface LogQaSource {
  logId: string;
  title: string;
  parentPath: string;
  matchCount: number;
}

export interface LogQaRetrievedExcerpt {
  logId: string;
  title: string;
  parentPath: string;
  text: string;
  matchKind?: SearchHit["matchKind"];
}

export interface LogQaRetrieval {
  sources: LogQaSource[];
  excerpts: LogQaRetrievedExcerpt[];
}

export interface LogQaResult {
  answer: string;
  sources: LogQaSource[];
  excerpts: LogQaRetrievedExcerpt[];
}

export interface AskLogsFromRagCallbacks {
  /** RAG 检索完成后立即回调（早于 LLM 流式回答） */
  onRetrieval?: (retrieval: LogQaRetrieval) => void;
  onAnswerDelta?: (delta: string) => void;
}

function truncate(s: string, max: number) {
  if (s.length <= max) return s;
  return `${s.slice(0, max)}\n…(truncated)`;
}

/** 将 RAG 检索结果整理为 LLM 上下文（仅日志摘录，不含记忆等） */
export function buildRagContextForQa(
  results: SearchResult[],
  maxPerHit: number,
  maxTotal: number,
  localeZh: boolean
): string {
  const pathLabel = localeZh ? "路径" : "Path";
  const parts: string[] = [];
  let used = 0;
  for (const result of results) {
    const title = result.node?.title?.trim() || result.parentPath || "(untitled)";
    const path = result.parentPath || title;
    for (const hit of result.hits) {
      const block = `### ${title}\n${pathLabel}: ${path}\n${truncate(hit.chunk.text, maxPerHit)}\n`;
      if (used + block.length > maxTotal) return parts.join("\n");
      parts.push(block);
      used += block.length;
    }
  }
  return parts.join("\n");
}

function excerptTextFromHit(hit: SearchHit, maxLen: number): string {
  const fromParts = hit.summaryParts.map((p) => p.text).join("").trim();
  const raw = fromParts || hit.chunk.text;
  return truncate(stripMarkupForSearchPreview(raw, maxLen * 2), maxLen);
}

/** 将检索结果整理为 UI 可展示的摘录列表 */
export function excerptsFromSearchResults(
  results: SearchResult[],
  maxPerHit = 900
): LogQaRetrievedExcerpt[] {
  const out: LogQaRetrievedExcerpt[] = [];
  for (const result of results) {
    const title = result.node?.title?.trim() || result.parentPath || "(untitled)";
    for (const hit of result.hits) {
      out.push({
        logId: result.logId,
        title,
        parentPath: result.parentPath || title,
        text: excerptTextFromHit(hit, maxPerHit),
        matchKind: hit.matchKind
      });
    }
  }
  return out;
}

export function sourcesFromSearchResults(results: SearchResult[], nodes: LogNode[]): LogQaSource[] {
  const nodeById = new Map(nodes.map((n) => [n.id, n]));
  return results
    .map((r) => ({
      logId: r.logId,
      title: r.node?.title?.trim() || r.parentPath || r.logId,
      parentPath: r.parentPath,
      matchCount: r.matchCount
    }))
    .sort((a, b) => {
      const na = nodeById.get(a.logId);
      const nb = nodeById.get(b.logId);
      if (na && nb) return compareByUpdatedAtDesc(na, nb);
      return b.matchCount - a.matchCount;
    });
}

export async function askLogsFromRag(
  rag: Pick<WorkshadowRag, "searchDocuments">,
  question: string,
  nodes: Parameters<WorkshadowRag["searchDocuments"]>[1],
  settings: AppSettings,
  options: {
    localeZh: boolean;
    memory?: MemoryEntry[];
    onKeywordFallbackNotice?: () => void;
  } & AskLogsFromRagCallbacks
): Promise<LogQaResult> {
  const trimmed = question.trim();
  if (!trimmed) {
    throw new Error(options.localeZh ? "请输入问题" : "Enter a question");
  }

  const verbose = isDevVerboseApiLogging();

  await traceLogQa(
    "ask_start",
    verbose ? { question: trimmed } : { questionLength: trimmed.length }
  );

  try {
    const rawResults = await rag.searchDocuments(trimmed, nodes, settings, {
      onKeywordFallbackNotice: options.onKeywordFallbackNotice
    });
    const results = trimSearchResultsForQaContext(
      rawResults,
      LOG_QA_MAX_PER_HIT_CHARS,
      LOG_QA_MAX_RAG_CHARS,
      options.localeZh
    );
    const sources = sourcesFromSearchResults(results, nodes);
    const excerpts = excerptsFromSearchResults(results);
    const retrieval: LogQaRetrieval = { sources, excerpts };
    options.onRetrieval?.(retrieval);

    const context = buildRagContextForQa(
      results,
      LOG_QA_MAX_PER_HIT_CHARS,
      LOG_QA_MAX_RAG_CHARS,
      options.localeZh
    );

    await traceLogQa(
      "rag_done",
      verbose
        ? {
            resultCount: results.length,
            rawResultCount: rawResults.length,
            sources,
            searchHits: serializeSearchResultsForLog(results, true),
            ragContext: context
          }
        : {
            resultCount: results.length,
            logIds: sources.map((s) => s.logId),
            sourceCount: sources.length
          }
    );

    const system = buildLogQaSystem(options.localeZh);
    const mem = buildMemoryContext(options.memory ?? [], LOG_QA_MAX_MEMORY_CHARS);
    const user = options.localeZh
      ? `## 长期记忆\n${mem || "（无）"}\n\n## 用户问题\n${trimmed}\n\n## 检索到的日志摘录\n${context || "（未检索到相关片段）"}\n`
      : `## Memory notes\n${mem || "(none)"}\n\n## Question\n${trimmed}\n\n## Retrieved log excerpts\n${context || "(no relevant excerpts)"}\n`;

    if (verbose) {
      await traceLogQa("llm_prompt", { system, user });
    }

    const answer = await streamChatText(settings, system, user, {
      purpose: "log_qa",
      onDelta: (delta) => options.onAnswerDelta?.(delta)
    });

    await traceLogQa(
      "ask_done",
      verbose
        ? { answer, sources, excerpts, answerChars: answer.length }
        : { answerChars: answer.length, sourceCount: sources.length, excerptCount: excerpts.length }
    );

    return { answer, sources, excerpts };
  } catch (e) {
    const error = formatUnknownError(e);
    await traceLogQa("ask_failed", { error });
    throw e;
  }
}
