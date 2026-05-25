import type { DocumentGenerationPref } from "../types";

export const DOC_PREF_LOG_SUMMARY = "log_summary";

/** @deprecated 旧版日报偏好，仅用于迁移读取 */
const LEGACY_DAILY = "daily_report";
/** @deprecated 旧版周报偏好，仅用于迁移读取 */
const LEGACY_WEEKLY = "weekly_report";

export function normalizeDocumentGenerationPrefs(raw: unknown): DocumentGenerationPref[] {
  if (!Array.isArray(raw)) return [];
  const out: DocumentGenerationPref[] = [];
  for (const row of raw) {
    if (!row || typeof row !== "object") continue;
    const r = row as Record<string, unknown>;
    const docKind = typeof r.docKind === "string" ? r.docKind : null;
    if (!docKind) continue;
    const focus = typeof r.focus === "string" ? r.focus : "";
    const style = typeof r.style === "string" ? r.style : "";
    const updatedAt = typeof r.updatedAt === "string" ? r.updatedAt : new Date().toISOString();
    out.push({ docKind, focus, style, updatedAt });
  }
  return out;
}

export function getDocumentPref(prefs: DocumentGenerationPref[], docKind: string): Pick<DocumentGenerationPref, "focus" | "style"> {
  const row = prefs.find((p) => p.docKind === docKind);
  return { focus: row?.focus ?? "", style: row?.style ?? "" };
}

/** 日志总结偏好；若尚未保存，则合并旧版日报/周报的 focus/style */
export function getLogSummaryPref(prefs: DocumentGenerationPref[]): Pick<DocumentGenerationPref, "focus" | "style"> {
  const current = getDocumentPref(prefs, DOC_PREF_LOG_SUMMARY);
  if (current.focus.trim() || current.style.trim()) return current;
  const daily = getDocumentPref(prefs, LEGACY_DAILY);
  const weekly = getDocumentPref(prefs, LEGACY_WEEKLY);
  return {
    focus: daily.focus || weekly.focus,
    style: daily.style || weekly.style
  };
}

export function upsertDocumentPref(
  prefs: DocumentGenerationPref[],
  docKind: string,
  patch: Partial<Pick<DocumentGenerationPref, "focus" | "style">>
): DocumentGenerationPref[] {
  const now = new Date().toISOString();
  const idx = prefs.findIndex((p) => p.docKind === docKind);
  const prev = idx >= 0 ? prefs[idx] : { docKind, focus: "", style: "", updatedAt: now };
  const next: DocumentGenerationPref = {
    docKind,
    focus: patch.focus !== undefined ? patch.focus : prev.focus,
    style: patch.style !== undefined ? patch.style : prev.style,
    updatedAt: now
  };
  if (idx >= 0) {
    const copy = [...prefs];
    copy[idx] = next;
    return copy;
  }
  return [...prefs, next];
}
