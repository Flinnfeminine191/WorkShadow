import { invoke } from "@tauri-apps/api/core";
import { isTauriRuntime } from "./storage";

export interface LanceMetaPublic {
  schemaVersion: number;
  embeddingModel: string;
  embeddingDim: number;
  vectorMetric: string;
}

export interface RagInspectLogStat {
  logId: string;
  chunkCount: number;
}

export interface RagInspectRow {
  id: string;
  logId: string;
  text: string;
  timestamp: string;
  parentPath: string;
  position: number;
  contentHash: string;
  embeddingModel: string;
  embeddingDim: number;
  vectorPreview: string;
  vectorL2Norm: number;
}

export interface RagInspectResponse {
  exists: boolean;
  directory: string;
  tableName: string;
  meta: LanceMetaPublic | null;
  totalRows: number;
  filteredRows: number;
  logStats: RagInspectLogStat[];
  rows: RagInspectRow[];
  warning: string | null;
}

export interface RagInspectRequest {
  limit?: number;
  offset?: number;
  logIdFilter?: string | null;
  includeVectorPreview?: boolean;
}

export async function inspectLanceDb(request: RagInspectRequest = {}): Promise<RagInspectResponse> {
  if (!isTauriRuntime()) {
    return {
      exists: false,
      directory: "",
      tableName: "log_chunks",
      meta: null,
      totalRows: 0,
      filteredRows: 0,
      logStats: [],
      rows: [],
      warning: null
    };
  }
  return invoke<RagInspectResponse>("rag_inspect", {
    request: {
      limit: request.limit ?? 40,
      offset: request.offset ?? 0,
      logIdFilter: request.logIdFilter ?? null,
      includeVectorPreview: request.includeVectorPreview ?? true
    }
  });
}

export async function openLanceDbDirectory(): Promise<void> {
  if (!isTauriRuntime()) return;
  await invoke("rag_open_lance_directory");
}
