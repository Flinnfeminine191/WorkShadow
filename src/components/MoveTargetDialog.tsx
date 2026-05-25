import { useEffect, useMemo, useState } from "react";
import { ChevronDown, ChevronRight, FileText, Folder } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { LogNode } from "../types";
import { getChildren, getDescendantIds, getPathTitle, wouldCreateCycle } from "../services/tree";

interface Props {
  open: boolean;
  nodes: LogNode[];
  movingId: string;
  onClose: () => void;
  onConfirm: (parentId: string | null) => void;
}

export function MoveTargetDialog({ open, nodes, movingId, onClose, onConfirm }: Props) {
  const { t } = useTranslation();
  const [selectedParentId, setSelectedParentId] = useState<string | null>(null);
  const [expandedIds, setExpandedIds] = useState<string[]>([]);

  const forbidden = useMemo(() => new Set<string>([movingId, ...getDescendantIds(nodes, movingId)]), [nodes, movingId]);

  useEffect(() => {
    if (!open) return;
    setSelectedParentId(null);
    const withChildren = nodes.filter((n) => nodes.some((c) => c.parentId === n.id)).map((n) => n.id);
    setExpandedIds(withChildren.length ? withChildren : nodes.slice(0, 5).map((n) => n.id));
  }, [open, nodes, movingId]);

  const canPick = (id: string | null) => {
    if (id === null) return true;
    if (forbidden.has(id)) return false;
    return !wouldCreateCycle(nodes, movingId, id);
  };

  if (!open) return null;

  function toggle(id: string) {
    setExpandedIds((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));
  }

  return (
    <div className="editor-dialog-layer" role="presentation">
      <div className="editor-dialog-mask" onClick={onClose} />
      <div className="editor-dialog editor-dialog--move" role="dialog" aria-labelledby="move-dialog-title">
        <header className="editor-dialog-header">
          <h2 id="move-dialog-title">{t("dialogMoveTitle")}</h2>
          <button type="button" className="ghost small" onClick={onClose}>
            {t("close")}
          </button>
        </header>
        <p className="muted editor-dialog-hint editor-dialog-hint--tight">{t("dialogMoveHint")}</p>
        <div className="move-target-tree">
          <button
            type="button"
            className={["move-target-row", "root", selectedParentId === null ? "selected" : ""].filter(Boolean).join(" ")}
            disabled={!canPick(null)}
            onClick={() => setSelectedParentId(null)}
          >
            {t("dialogMoveRoot")}
          </button>
          {renderLevel(null, 0)}
        </div>
        <footer className="editor-dialog-footer">
          <button type="button" className="ghost" onClick={onClose}>
            {t("cancel")}
          </button>
          <button
            type="button"
            className="primary"
            disabled={selectedParentId !== null && !canPick(selectedParentId)}
            onClick={() => {
              if (selectedParentId !== null && !canPick(selectedParentId)) return;
              onConfirm(selectedParentId);
            }}
          >
            {t("confirm")}
          </button>
        </footer>
      </div>
    </div>
  );

  function renderLevel(parentId: string | null, depth: number) {
    return getChildren(nodes, parentId).map((node) => {
      const children = getChildren(nodes, node.id);
      const expanded = expandedIds.includes(node.id);
      const disabled = !canPick(node.id);
      const selected = selectedParentId === node.id;
      return (
        <div key={node.id}>
          <div className="move-target-row-wrap" style={{ paddingLeft: 8 + depth * 16 }}>
            <button type="button" className="icon-button move-target-chevron" onClick={() => toggle(node.id)} aria-label="toggle">
              {children.length ? expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} /> : <span className="spacer" />}
            </button>
            <button
              type="button"
              className={["move-target-row", selected ? "selected" : "", disabled ? "disabled" : ""].filter(Boolean).join(" ")}
              disabled={disabled}
              onClick={() => !disabled && setSelectedParentId(node.id)}
              title={getPathTitle(nodes, node.id)}
            >
              {children.length > 0 ? <Folder size={16} /> : <FileText size={16} />}
              <span>{node.title}</span>
            </button>
          </div>
          {expanded && children.length > 0 ? renderLevel(node.id, depth + 1) : null}
        </div>
      );
    });
  }
}
