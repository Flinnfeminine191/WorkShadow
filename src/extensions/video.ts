import { mergeAttributes, Node } from "@tiptap/core";

export type VideoAttrs = {
  src: string | null;
  embedSrc?: string | null;
  caption?: string;
  width?: string | null;
};

function readVideoAttrsFromWrap(el: HTMLElement) {
  const inner = el.querySelector(".ws-media-video-inner");
  const iframe = (inner ?? el).querySelector("iframe[data-workshadow-video='1']");
  if (iframe) {
    const embedSrc = iframe.getAttribute("src");
    if (!embedSrc) return false;
    const page = iframe.getAttribute("data-page-url");
    const cap = el.querySelector(".ws-media-caption");
    const w = el.getAttribute("data-width");
    return { src: page || embedSrc, embedSrc, caption: cap?.textContent?.trim() ?? "", width: w || null };
  }
  const vid = (inner ?? el).querySelector("video");
  const src = vid?.getAttribute("src");
  if (!src) return false;
  const cap = el.querySelector(".ws-media-caption");
  const w = el.getAttribute("data-width");
  return { src, embedSrc: null, caption: cap?.textContent?.trim() ?? "", width: w || null };
}

export const Video = Node.create({
  name: "video",
  group: "block",
  atom: true,
  draggable: true,
  addAttributes() {
    return {
      src: {
        default: null
      },
      embedSrc: {
        default: null
      },
      caption: {
        default: ""
      },
      width: {
        default: null as string | null,
        parseHTML: (el) => (el instanceof HTMLElement ? el.getAttribute("data-width") : null),
        renderHTML: (attrs) => {
          const w = attrs.width as string | null | undefined;
          if (!w) return {};
          return { "data-width": w };
        }
      },
      controls: {
        default: true
      }
    };
  },
  addNodeView() {
    return ({ node: initialNode, editor, getPos }) => {
      const wrap = document.createElement("div");
      wrap.className = "ws-media-wrap ws-media-wrap--video";
      wrap.setAttribute("data-ws-lightbox", "1");

      const inner = document.createElement("div");
      inner.className = "ws-media-video-inner";

      const handle = document.createElement("div");
      handle.className = "ws-media-resize-handle ws-media-resize-handle--video";
      handle.contentEditable = "false";

      const caption = document.createElement("div");
      caption.className = "ws-media-caption";

      let mediaEl: HTMLIFrameElement | HTMLVideoElement | null = null;
      let activeMove: ((e: MouseEvent) => void) | null = null;
      let activeUp: (() => void) | null = null;

      function maxResizePx(proseMax: number): number {
        return proseMax;
      }

      function buildMedia(n: typeof initialNode) {
        inner.replaceChildren();
        const embedSrc = n.attrs.embedSrc as string | null | undefined;
        const pageSrc = (n.attrs.src as string | null | undefined) || "";
        if (embedSrc) {
          const iframe = document.createElement("iframe");
          iframe.setAttribute("data-workshadow-video", "1");
          if (pageSrc) iframe.setAttribute("data-page-url", pageSrc);
          iframe.src = embedSrc;
          iframe.setAttribute("allowfullscreen", "true");
          iframe.setAttribute("frameborder", "0");
          iframe.style.cssText =
            "width:100%;max-width:none;aspect-ratio:16/9;height:auto;border:0;border-radius:12px;background:#000;display:block;box-sizing:border-box;";
          mediaEl = iframe;
          inner.appendChild(iframe);
        } else {
          const video = document.createElement("video");
          video.controls = true;
          video.setAttribute("playsinline", "");
          video.style.cssText =
            "width:100%;max-width:none;height:auto;border-radius:12px;display:block;box-sizing:border-box;";
          const src = String(n.attrs.src ?? "");
          if (src) video.src = src;
          mediaEl = video;
          inner.appendChild(video);
        }
        inner.appendChild(handle);
      }

      function sync(n: typeof initialNode) {
        const cap = String(n.attrs.caption ?? "").trim();
        caption.textContent = cap;
        caption.style.display = cap ? "block" : "none";
        const w = n.attrs.width as string | null | undefined;
        wrap.style.maxWidth = "100%";
        wrap.style.width = w ?? "";
        inner.style.display = "block";
        inner.style.width = "100%";
        inner.style.boxSizing = "border-box";
        const prevSrc = mediaEl && "src" in mediaEl ? (mediaEl as HTMLVideoElement).src : "";
        const prevEmbed = mediaEl && "src" in mediaEl && mediaEl.tagName === "IFRAME" ? (mediaEl as HTMLIFrameElement).src : "";
        const nextEmbed = n.attrs.embedSrc as string | null | undefined;
        const nextSrc = String(n.attrs.src ?? "");
        const needRebuild =
          !mediaEl ||
          (nextEmbed && (mediaEl.tagName !== "IFRAME" || prevEmbed !== nextEmbed)) ||
          (!nextEmbed && (mediaEl.tagName !== "VIDEO" || prevSrc !== nextSrc));
        if (needRebuild) {
          buildMedia(n);
        }
      }

      wrap.appendChild(inner);
      wrap.appendChild(caption);

      sync(initialNode);

      handle.addEventListener("mousedown", (e) => {
        e.preventDefault();
        e.stopPropagation();
        const pos = typeof getPos === "function" ? getPos() : undefined;
        if (pos !== undefined) {
          editor.chain().focus().setNodeSelection(pos).run();
        }

        const prose =
          (editor.view.dom as HTMLElement).closest(".rich-editor")?.querySelector(".ProseMirror") ??
          (editor.view.dom as HTMLElement);
        const proseMax = prose.getBoundingClientRect().width || 480;
        const dragStartX = e.clientX;
        const dragStartW = wrap.getBoundingClientRect().width;
        const moveHandler = (me: MouseEvent) => {
          const delta = me.clientX - dragStartX;
          const capMax = maxResizePx(proseMax);
          const next = Math.min(capMax, Math.max(160, dragStartW + delta));
          wrap.style.width = `${next}px`;
          inner.style.width = "100%";
        };

        const upHandler = () => {
          document.removeEventListener("mousemove", moveHandler);
          document.removeEventListener("mouseup", upHandler);
          activeMove = null;
          activeUp = null;

          const p = typeof getPos === "function" ? getPos() : undefined;
          if (p === undefined) return;

          const wPx = Math.min(wrap.getBoundingClientRect().width, proseMax);
          const pct = Math.min(100, Math.max(18, (wPx / proseMax) * 100));
          const rounded = Math.round(pct * 10) / 10;

          const cur = editor.state.doc.nodeAt(p);
          if (!cur || cur.type.name !== "video") return;

          editor.view.dispatch(
            editor.state.tr.setNodeMarkup(p, undefined, {
              ...cur.attrs,
              width: `${rounded}%`
            })
          );
        };

        activeMove = moveHandler;
        activeUp = upHandler;
        document.addEventListener("mousemove", moveHandler);
        document.addEventListener("mouseup", upHandler);
      });

      return {
        dom: wrap,
        update: (updated) => {
          if (updated.type.name !== "video") return false;
          sync(updated);
          return true;
        },
        destroy: () => {
          if (activeMove) document.removeEventListener("mousemove", activeMove);
          if (activeUp) document.removeEventListener("mouseup", activeUp);
        }
      };
    };
  },
  parseHTML() {
    return [
      { tag: "video[src]" },
      {
        tag: "div.ws-media-wrap--video",
        priority: 65,
        getAttrs: (element) => {
          if (!(element instanceof HTMLElement)) return false;
          return readVideoAttrsFromWrap(element);
        }
      },
      {
        tag: "iframe[data-workshadow-video='1']",
        getAttrs: (element) => {
          if (!(element instanceof HTMLElement)) return false;
          const embedSrc = element.getAttribute("src");
          if (!embedSrc) return false;
          const page = element.getAttribute("data-page-url");
          return { src: page || embedSrc, embedSrc };
        }
      }
    ];
  },
  renderHTML({ node, HTMLAttributes }) {
    const embedSrc = node.attrs.embedSrc as string | null | undefined;
    const pageSrc = (node.attrs.src as string | null | undefined) || "";
    const cap = String(node.attrs.caption ?? "").trim();
    const width = node.attrs.width as string | null | undefined;
    const wrapStyle = width ? `max-width:100%;width:${width}` : "max-width:100%";

    const media = embedSrc
      ? ([
          "iframe",
          mergeAttributes(
            {
              "data-workshadow-video": "1",
              "data-page-url": pageSrc || undefined,
              src: embedSrc,
              allowfullscreen: "true",
              frameborder: "0",
              style:
                "width:100%;max-width:none;aspect-ratio:16/9;height:auto;border:0;border-radius:12px;background:#000;display:block;box-sizing:border-box;"
            },
            {}
          )
        ] as const)
      : ([
          "video",
          mergeAttributes(HTMLAttributes, {
            controls: true,
            playsInline: true,
            style: "width:100%;max-width:none;height:auto;border-radius:12px;display:block;box-sizing:border-box;"
          })
        ] as const);

    return [
      "div",
      {
        class: "ws-media-wrap ws-media-wrap--video",
        "data-ws-lightbox": "1",
        style: wrapStyle
      },
      ["div", { class: "ws-media-video-inner" }, media],
      ...(cap ? [["div", { class: "ws-media-caption" }, cap]] as const : [])
    ];
  }
});
