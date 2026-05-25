import { TableCell } from "@tiptap/extension-table-cell";
import { TableHeader } from "@tiptap/extension-table-header";

const verticalAlignAttr = {
  default: null as string | null,
  parseHTML: (element: HTMLElement) => {
    const v = (element.style.verticalAlign || "").trim().toLowerCase();
    if (v === "top" || v === "middle" || v === "bottom") return v;
    return null;
  },
  renderHTML: (attributes: Record<string, unknown>) => {
    const v = attributes.verticalAlign as string | null | undefined;
    if (!v) return {};
    return { style: `vertical-align: ${v}` };
  }
};

export const TableCellVertical = TableCell.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      verticalAlign: verticalAlignAttr
    };
  }
});

export const TableHeaderVertical = TableHeader.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      verticalAlign: verticalAlignAttr
    };
  }
});
