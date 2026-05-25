import type { Editor } from "@tiptap/react";

export type LightboxItem =
  | { type: "image"; src: string; caption: string }
  | { type: "video"; src: string; embedSrc: string | null; caption: string };

export function collectLightboxItems(editor: Editor): LightboxItem[] {
  const out: LightboxItem[] = [];
  editor.state.doc.descendants((node) => {
    if (node.type.name === "image") {
      const src = String(node.attrs.src ?? "");
      if (src) out.push({ type: "image", src, caption: String(node.attrs.caption ?? "") });
    }
    if (node.type.name === "video") {
      const src = String(node.attrs.src ?? "");
      const embedSrc = (node.attrs.embedSrc as string | null | undefined) ?? null;
      if (src || embedSrc) {
        out.push({ type: "video", src, embedSrc, caption: String(node.attrs.caption ?? "") });
      }
    }
  });
  return out;
}

export function findLightboxIndex(items: LightboxItem[], hit: { type: "image" | "video"; src: string; embedSrc?: string | null }): number {
  return items.findIndex((it) => {
    if (hit.type === "image" && it.type === "image") return it.src === hit.src;
    if (hit.type === "video" && it.type === "video") {
      if (hit.embedSrc && it.embedSrc) return it.embedSrc === hit.embedSrc;
      return it.src === hit.src;
    }
    return false;
  });
}
