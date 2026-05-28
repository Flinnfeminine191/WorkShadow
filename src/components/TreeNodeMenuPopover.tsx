import { useLayoutEffect, useRef, useState, type RefObject } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import type { LogNode } from "../types";

const MENU_WIDTH = 168;
const MENU_ESTIMATED_HEIGHT = 268;
const VIEWPORT_PAD = 8;

export type TreeNodeMenuAction = "child" | "sibling" | "rename" | "move" | "duplicate" | "delete";

interface Props {
  node: LogNode;
  open: boolean;
  anchorRef: RefObject<HTMLButtonElement | null>;
  onAction: (action: TreeNodeMenuAction, node: LogNode) => void;
}

function computeMenuPosition(anchor: HTMLElement): { top: number; left: number } {
  const rect = anchor.getBoundingClientRect();
  let left = rect.right - MENU_WIDTH;
  let top = rect.bottom + 4;

  if (left < VIEWPORT_PAD) left = VIEWPORT_PAD;
  if (left + MENU_WIDTH > window.innerWidth - VIEWPORT_PAD) {
    left = window.innerWidth - MENU_WIDTH - VIEWPORT_PAD;
  }
  if (top + MENU_ESTIMATED_HEIGHT > window.innerHeight - VIEWPORT_PAD) {
    top = Math.max(VIEWPORT_PAD, rect.top - MENU_ESTIMATED_HEIGHT - 4);
  }

  return { top, left };
}

export function TreeNodeMenuPopover({ node, open, anchorRef, onAction }: Props) {
  const { t } = useTranslation();
  const menuRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);

  useLayoutEffect(() => {
    if (!open) {
      setPosition(null);
      return;
    }
    const anchor = anchorRef.current;
    if (!anchor) return;

    const update = () => {
      const menuEl = menuRef.current;
      const measuredHeight = menuEl?.offsetHeight ?? MENU_ESTIMATED_HEIGHT;
      const base = computeMenuPosition(anchor);
      const rect = anchor.getBoundingClientRect();
      let top = base.top;
      if (top + measuredHeight > window.innerHeight - VIEWPORT_PAD) {
        top = Math.max(VIEWPORT_PAD, rect.top - measuredHeight - 4);
      }
      setPosition({ top, left: base.left });
    };

    update();
    const raf = requestAnimationFrame(update);
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [open, anchorRef, node.id]);

  if (!open) return null;
  const anchor = anchorRef.current;
  if (!anchor) return null;
  const coords = position ?? computeMenuPosition(anchor);

  return createPortal(
    <div
      ref={menuRef}
      className="menu-popover menu-popover--portal"
      role="menu"
      data-tree-menu-popover=""
      data-tree-menu-node-id={node.id}
      style={{ top: coords.top, left: coords.left }}
    >
      <button type="button" role="menuitem" onClick={() => onAction("child", node)}>
        {t("newChild")}
      </button>
      <button type="button" role="menuitem" onClick={() => onAction("sibling", node)}>
        {t("newSibling")}
      </button>
      <button type="button" role="menuitem" onClick={() => onAction("rename", node)}>
        {t("rename")}
      </button>
      <button type="button" role="menuitem" onClick={() => onAction("move", node)}>
        {t("move")}
      </button>
      <button type="button" role="menuitem" onClick={() => onAction("duplicate", node)}>
        {t("duplicate")}
      </button>
      <button type="button" role="menuitem" className="danger-text" onClick={() => onAction("delete", node)}>
        {t("delete")}
      </button>
    </div>,
    document.body
  );
}
