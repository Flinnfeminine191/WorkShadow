import { useEffect, useMemo, useState } from "react";
import { ChevronDown, ChevronRight, FileText, Folder } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { LogNode } from "../types";
import { getChildren } from "../services/tree";

interface Props {
  open: boolean;
  nodes: LogNode[];
  onClose: () => void;
  onMove: (ids: string[], parentId: string | null) => void;
  onDelete: (ids: string[]) => void;
}

type MoveOption = { id: string; depth: number; title: string };

function collectMoveOptions(nodes: LogNode[], parentId: string | null, depth: number, out: MoveOption[]) {
  for (const node of getChildren(nodes, parentId)) {
    out.push({ id: node.id, depth, title: node.title });
    collectMoveOptions(nodes, node.id, depth + 1, out);
  }
}

export function BatchPanel({ open, nodes, onClose, onMove, onDelete }: Props) {
  const { t } = useTranslation();
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [targetId, setTargetId] = useState<string>("");
  const [expandedIds, setExpandedIds] = useState<string[]>([]);

  const branchIds = useMemo(
    () => nodes.filter((n) => nodes.some((c) => c.parentId === n.id)).map((n) => n.id),
    [nodes]
  );

  const moveOptions = useMemo(() => {
    const out: MoveOption[] = [];
    collectMoveOptions(nodes, null, 0, out);
    return out;
  }, [nodes]);

  useEffect(() => {
    if (!open) return;
    setSelectedIds([]);
    setTargetId("");
    setExpandedIds(branchIds.length ? [...branchIds] : []);
  }, [open, branchIds]);

  if (!open) return null;

  function toggleExpanded(id: string) {
    setExpandedIds((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));
  }

  function renderTreeLevel(parentId: string | null, depth: number) {
    return getChildren(nodes, parentId).map((node) => {
      const children = getChildren(nodes, node.id);
      const expanded = expandedIds.includes(node.id);
      return (
        <div key={node.id}>
          <div className="batch-tree-row" style={{ paddingLeft: 8 + depth * 18 }}>
            <button type="button" className="icon-button batch-tree-chevron" onClick={() => toggleExpanded(node.id)} aria-label="toggle">
              {children.length ? expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} /> : <span className="spacer" />}
            </button>
            <label className="batch-tree-leaf">
              <input
                type="checkbox"
                checked={selectedIds.includes(node.id)}
                onChange={(event) =>
                  setSelectedIds((current) =>
                    event.target.checked ? [...current, node.id] : current.filter((id) => id !== node.id)
                  )
                }
              />
              {children.length > 0 ? <Folder size={16} className="batch-tree-icon" aria-hidden /> : <FileText size={16} className="batch-tree-icon" aria-hidden />}
              <span>{node.title}</span>
            </label>
          </div>
          {children.length > 0 && expanded ? renderTreeLevel(node.id, depth + 1) : null}
        </div>
      );
    });
  }

  return (
    <div className="batch-layer">
      <div className="batch-mask" onClick={onClose} />
      <aside className="batch-panel">
        <header>
          <h2>{t("batch")}</h2>
          <button type="button" className="ghost" onClick={onClose}>
            {t("close")}
          </button>
        </header>
        <div className="batch-panel-scroll">
          <div className="batch-list batch-list--tree">{renderTreeLevel(null, 0)}</div>
        </div>
        <div className="batch-panel-footer">
          <label className="batch-move-field">
            <span>{t("moveTo")}</span>
            <select value={targetId} onChange={(event) => setTargetId(event.target.value)}>
              <option value="">{t("dialogMoveRoot")}</option>
              {moveOptions.map(({ id, depth, title }) => (
                <option key={id} value={id}>
                  {"\u2003".repeat(depth)}
                  {title}
                </option>
              ))}
            </select>
          </label>
          <div className="batch-actions">
            <button type="button" className="ghost" disabled={!selectedIds.length} onClick={() => onMove(selectedIds, targetId || null)}>
              {t("batchMove")}
            </button>
            <button type="button" className="danger" disabled={!selectedIds.length} onClick={() => onDelete(selectedIds)}>
              {t("batchDelete")}
            </button>
          </div>
        </div>
      </aside>
    </div>
  );
}
