/**
 * 检索分块（chunk）的唯一生产路径：读取 LogNode.tiptapJson，投影为纯文本后再切块。
 * 磁盘上的 .md / .tiptap.json 仅用于导出落盘，不参与本模块；markdown.ts 中的 splitMarkdown* 仅作测试/备用。
 */
import type { LogChunk, LogNode } from "../types";
import { fnv1aHash } from "./markdown";

type TiptapNode = {
  type?: string;
  text?: string;
  attrs?: Record<string, unknown>;
  marks?: { type?: string }[];
  content?: TiptapNode[];
};

export type TiptapChunk = LogChunk & {
  contentHash: string;
};

/** 分块边界规则变更时递增，以便索引侧重算 contentHash */
export const TIPTAP_CHUNK_HASH_VERSION = 2;
const MAX_CHUNK_CHARS = 3600;
const TARGET_SLICE = 2200;
/** 加粗小节标题最大字数（如「今日工作内容」） */
const MAX_SECTION_LABEL_CHARS = 48;

function plainInline(content?: TiptapNode[]): string {
  return (content ?? []).map(plainNodeText).join("").replace(/\s+/g, " ").trim();
}

function attrText(attrs: Record<string, unknown> | undefined, keys: string[]) {
  if (!attrs) return "";
  for (const key of keys) {
    const value = attrs[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
}

function mediaCaption(node: TiptapNode): string {
  const caption = attrText(node.attrs, ["caption", "title", "alt", "label"]);
  return caption ? `媒体标题：${caption}` : "";
}

function tableText(node: TiptapNode): string {
  const rows: string[] = [];
  for (const row of node.content ?? []) {
    if (row.type !== "tableRow") continue;
    const cells = (row.content ?? [])
      .filter((cell) => cell.type === "tableCell" || cell.type === "tableHeader")
      .map((cell) => plainInline(cell.content));
    if (cells.length) rows.push(cells.join(" | "));
  }
  return rows.join("\n");
}

function plainNodeText(node: TiptapNode): string {
  switch (node.type) {
    case "text":
      return node.text ?? "";
    case "image":
    case "video":
      return mediaCaption(node);
    case "inlineMath":
    case "blockMath":
      return attrText(node.attrs, ["latex"]);
    case "hardBreak":
      return "\n";
    case "table":
      return tableText(node);
    default:
      return (node.content ?? []).map(plainNodeText).join(node.type?.endsWith("List") ? "\n" : " ");
  }
}

/** 工作日志常见段落：段首加粗为小节名，后接 「：」 与正文/列表（无 heading 节点） */
export function paragraphBoldSectionLabel(node: TiptapNode): string | null {
  if (node.type !== "paragraph") return null;
  const runs: { text: string; bold: boolean }[] = [];
  for (const child of node.content ?? []) {
    if (child.type !== "text") continue;
    runs.push({
      text: child.text ?? "",
      bold: (child.marks ?? []).some((m) => m.type === "bold")
    });
  }
  if (!runs.length || !runs[0].bold) return null;

  let label = "";
  let i = 0;
  for (; i < runs.length; i++) {
    if (!runs[i].bold) break;
    label += runs[i].text;
  }
  label = label.replace(/\s+/g, " ").trim();
  if (!label || [...label].length > MAX_SECTION_LABEL_CHARS) return null;

  const rest = runs
    .slice(i)
    .map((r) => r.text)
    .join("")
    .trim();
  if (rest === "" || /^[：:]\s*/.test(rest)) return label;
  return null;
}

export function isSectionBoundaryNode(node: TiptapNode): boolean {
  if (node.type === "heading") return true;
  return paragraphBoldSectionLabel(node) !== null;
}

function blockText(node: TiptapNode): string {
  if (node.type === "heading") {
    const level = Math.max(1, Math.min(6, Number(node.attrs?.level ?? 2)));
    const text = plainInline(node.content);
    return text ? `${"#".repeat(level)} ${text}` : "";
  }
  if (node.type === "paragraph") {
    const full = plainInline(node.content);
    if (paragraphBoldSectionLabel(node) && full) {
      return `## ${full}`;
    }
  }
  if (node.type === "image" || node.type === "video") return mediaCaption(node);
  if (node.type === "bulletList" || node.type === "orderedList") {
    return plainNodeText(node).replace(/\n{3,}/g, "\n\n").trim();
  }
  return plainNodeText(node).replace(/\n{3,}/g, "\n\n").trim();
}

function topLevelBlocks(doc: unknown): { node: TiptapNode; text: string }[] {
  const root = doc as TiptapNode | null | undefined;
  const out: { node: TiptapNode; text: string }[] = [];
  for (const node of root?.content ?? []) {
    const text = blockText(node).trim();
    if (text) out.push({ node, text });
  }
  return out;
}

function pushSliced(out: string[], value: string) {
  const text = value.trim();
  if (!text) return;
  if (text.length <= MAX_CHUNK_CHARS) {
    out.push(text);
    return;
  }

  const parts = text.split(/\n{2,}/);
  let acc = "";
  const flush = () => {
    if (acc.trim()) out.push(acc.trim());
    acc = "";
  };
  const hardSlice = (raw: string) => {
    let start = 0;
    while (start < raw.length) {
      let end = Math.min(start + MAX_CHUNK_CHARS, raw.length);
      if (end < raw.length) {
        const slice = raw.slice(start, end);
        const breakAt = Math.max(slice.lastIndexOf("\n"), slice.lastIndexOf("。"), slice.lastIndexOf("！"), slice.lastIndexOf("？"));
        if (breakAt > TARGET_SLICE / 2) end = start + breakAt + 1;
      }
      out.push(raw.slice(start, end).trim());
      start = end;
    }
  };

  for (const part of parts) {
    const p = part.trim();
    if (!p) continue;
    if (p.length > MAX_CHUNK_CHARS) {
      flush();
      hardSlice(p);
      continue;
    }
    if (acc.length + p.length + 2 <= TARGET_SLICE) {
      acc = acc ? `${acc}\n\n${p}` : p;
    } else {
      flush();
      acc = p;
    }
  }
  flush();
}

export function splitTiptapToBlocks(doc: unknown): string[] {
  const blocks = topLevelBlocks(doc);
  const chunks: string[] = [];
  let acc = "";

  const flush = () => {
    pushSliced(chunks, acc);
    acc = "";
  };

  for (const { node, text: block } of blocks) {
    if (isSectionBoundaryNode(node) && acc.trim()) flush();
    if (acc.length + block.length + 2 > MAX_CHUNK_CHARS) flush();
    acc = acc ? `${acc}\n\n${block}` : block;
  }
  flush();

  return chunks;
}

export function hashTiptapChunk(text: string) {
  return fnv1aHash(`${TIPTAP_CHUNK_HASH_VERSION}\0${text}`);
}

export function hashTiptapDocument(doc: unknown) {
  return fnv1aHash(`${TIPTAP_CHUNK_HASH_VERSION}\0${splitTiptapToBlocks(doc).join("\0")}`);
}

export function splitTiptapIntoChunks(node: LogNode, parentPath: string, timestamp = new Date().toISOString()): TiptapChunk[] {
  return splitTiptapToBlocks(node.tiptapJson).map((text, position) => ({
    id: `${node.id}:${position}`,
    logId: node.id,
    text,
    timestamp,
    parentPath,
    position,
    contentHash: hashTiptapChunk(text)
  }));
}
