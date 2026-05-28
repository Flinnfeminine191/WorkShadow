import type { ModelProvider } from "./services/modelProviders";

export type Language = "zh" | "en" | "system";
export type ThemeMode = "light" | "dark";
export type MediaStrategy = "embed" | "reference";
export type NodeKind = "folder" | "log";

/** 语义检索可用时，向量结果与关键词结果的展示顺序 */
export type SearchResultOrder = "combined" | "semanticFirst" | "keywordFirst";

export interface ModelConfig {
  provider?: ModelProvider;
  baseUrl: string;
  apiKey: string;
  model: string;
}

/** 按服务商存档；每个 provider 键至多一条 */
export type ModelProfiles = Partial<Record<ModelProvider, ModelConfig>>;

/** 与 Ctrl / ⌘ 的组合方式；新建日志等场景请使用 ctrl、meta 或 ctrlOrMeta */
export type ShortcutMod = "none" | "ctrl" | "meta" | "ctrlOrMeta";

/** 使用 KeyboardEvent.code（布局无关），如 KeyN、Escape、ArrowLeft */
export interface ShortcutBinding {
  code: string;
  mod: ShortcutMod;
  shift: boolean;
  alt: boolean;
}

export interface ShortcutMap {
  newLog: ShortcutBinding;
  /** 系统级快捷键：在应用未聚焦时也可新建日志（桌面端 Tauri） */
  globalNewLog: ShortcutBinding;
  lightboxClose: ShortcutBinding;
  lightboxPrev: ShortcutBinding;
  lightboxNext: ShortcutBinding;
  treeMenuClose: ShortcutBinding;
}

export interface AppSettings {
  language: Language;
  theme: ThemeMode;
  logDirectory: string;
  tempDirectory: string;
  mediaStrategy: MediaStrategy;
  /** 当前生效的 LLM 配置 */
  llm: ModelConfig;
  /** 各服务商已填写的 LLM 快照 */
  llmProfiles?: ModelProfiles;
  vlm: ModelConfig;
  /** 已应用的 Embedding（参与 LanceDB 索引） */
  embedding: ModelConfig;
  /** 各服务商 Embedding 草稿 */
  embeddingProfiles?: ModelProfiles;
  searchResultOrder: SearchResultOrder;
  semanticMinSimilarity: number;
  shortcuts: ShortcutMap;
}

export interface LogNode {
  id: string;
  parentId: string | null;
  title: string;
  kind: NodeKind;
  createdAt: string;
  updatedAt: string;
  tiptapJson: unknown;
  markdown: string;
  markdownPath?: string;
  jsonPath?: string;
}

export interface LogChunk {
  id: string;
  logId: string;
  text: string;
  timestamp: string;
  parentPath: string;
  position: number;
  score?: number;
}

export interface SearchSnippetPart {
  text: string;
  /** @deprecated 请用 emphasis；保留以兼容关键词路径 */
  highlight?: boolean;
  /** keyword：关键词加粗；semantic-term：语义命中中的字面词；semantic-region：无语面关键词时的相关 chunk 片段 */
  emphasis?: "keyword" | "semantic-term" | "semantic-region";
}

/** 单篇日志内的一处匹配（对应一个分块） */
export interface SearchHit {
  chunk: LogChunk;
  summaryParts: SearchSnippetPart[];
  /** 向量语义命中（摘要走语义高亮）；否则为关键词/本地模糊命中 */
  matchKind?: "semantic" | "keyword";
}

/** 按日志聚合的搜索结果：便于先定位到日志，再在正文内自行查看 */
export interface SearchResult {
  logId: string;
  node?: LogNode;
  parentPath: string;
  /** 该日志下最高相关度（用于排序） */
  score: number;
  /** 命中的分块总数（可能多于展示的 hits 条数） */
  matchCount: number;
  hits: SearchHit[];
}

export interface IndexStatus {
  logId: string;
  indexedAt: string;
  chunkCount: number;
  status: "indexed" | "pending" | "failed";
  error?: string;
}

/** 用户维护的长期记忆片段，参与日志总结与日志问答时的上下文（模型仅在与任务相关时使用） */
export interface MemoryEntry {
  id: string;
  title: string;
  body: string;
  updatedAt: string;
}

/** 文档生成偏好（日志总结及后续同类功能共用持久化模型） */
export interface DocumentGenerationPref {
  docKind: string;
  focus: string;
  style: string;
  updatedAt: string;
}

export interface AppState {
  settings: AppSettings;
  nodes: LogNode[];
  expandedNodeIds: string[];
  indexStatus: IndexStatus[];
  memoryEntries: MemoryEntry[];
  documentGenerationPrefs: DocumentGenerationPref[];
}

export interface ConfirmOptions {
  title: string;
  message: string;
  danger?: boolean;
}

export interface PromptOptions {
  title: string;
  message?: string;
  defaultValue: string;
  placeholder?: string;
}
