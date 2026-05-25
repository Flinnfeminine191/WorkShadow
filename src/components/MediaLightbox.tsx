import { useCallback, useEffect, useState, type MouseEvent } from "react";
import { createPortal } from "react-dom";
import { ChevronLeft, ChevronRight, ZoomIn, ZoomOut, RotateCcw, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { LightboxItem } from "../services/mediaGallery";
import type { ShortcutMap } from "../types";
import { matchesShortcut } from "../services/shortcuts";

interface Props {
  open: boolean;
  items: LightboxItem[];
  index: number;
  shortcuts: ShortcutMap;
  onClose: () => void;
  onIndexChange: (index: number) => void;
}

export function MediaLightbox({ open, items, index, shortcuts, onClose, onIndexChange }: Props) {
  const { t } = useTranslation();
  const [zoom, setZoom] = useState(1);

  const safeIndex = items.length ? Math.min(Math.max(0, index), items.length - 1) : 0;
  const item = items[safeIndex];

  const goPrev = useCallback(() => {
    if (items.length < 2) return;
    onIndexChange((safeIndex - 1 + items.length) % items.length);
  }, [items.length, onIndexChange, safeIndex]);

  const goNext = useCallback(() => {
    if (items.length < 2) return;
    onIndexChange((safeIndex + 1) % items.length);
  }, [items.length, onIndexChange, safeIndex]);

  const itemKey = item ? (item.type === "image" ? item.src : `${item.src}\0${item.embedSrc ?? ""}`) : "";

  useEffect(() => {
    setZoom(1);
  }, [safeIndex, itemKey, open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (matchesShortcut(e, shortcuts.lightboxClose)) {
        e.preventDefault();
        onClose();
        return;
      }
      if (items.length >= 2 && matchesShortcut(e, shortcuts.lightboxPrev)) {
        e.preventDefault();
        goPrev();
        return;
      }
      if (items.length >= 2 && matchesShortcut(e, shortcuts.lightboxNext)) {
        e.preventDefault();
        goNext();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose, goPrev, goNext, items.length, shortcuts]);

  if (!open || !item) return null;

  const stop = (e: MouseEvent) => e.stopPropagation();
  const isImage = item.type === "image";

  const layer = (
    <div className="media-lightbox-layer" role="presentation" onMouseDown={onClose}>
      <button
        type="button"
        className="media-lightbox-close icon-button"
        onMouseDown={stop}
        onClick={onClose}
        aria-label={t("close")}
      >
        <X size={22} />
      </button>
      {items.length > 1 ? (
        <button
          type="button"
          className="media-lightbox-nav media-lightbox-nav--prev"
          onMouseDown={stop}
          onClick={goPrev}
          aria-label={t("mediaLightboxPrev")}
        >
          <ChevronLeft size={28} />
        </button>
      ) : null}
      {items.length > 1 ? (
        <button
          type="button"
          className="media-lightbox-nav media-lightbox-nav--next"
          onMouseDown={stop}
          onClick={goNext}
          aria-label={t("mediaLightboxNext")}
        >
          <ChevronRight size={28} />
        </button>
      ) : null}
      <div className="media-lightbox-stage" onMouseDown={stop}>
        {item.type === "image" ? (
          <div
            className="media-lightbox-img-zoom"
            style={{ transform: `scale(${zoom})`, transformOrigin: "center center" }}
          >
            <img className="media-lightbox-media" src={item.src} alt="" draggable={false} />
          </div>
        ) : item.embedSrc ? (
          <iframe
            className="media-lightbox-media media-lightbox-iframe"
            title="video"
            src={item.embedSrc}
            allowFullScreen
            frameBorder={0}
          />
        ) : (
          <video className="media-lightbox-media" src={item.src} controls playsInline />
        )}
        {item.caption ? <p className="media-lightbox-caption">{item.caption}</p> : null}
      </div>
      {isImage ? (
        <div className="media-lightbox-zoombar" onMouseDown={stop}>
          <button
            type="button"
            className="media-lightbox-zoombtn icon-button"
            aria-label={t("mediaLightboxZoomIn")}
            onClick={() => setZoom((z) => Math.min(4, Math.round((z * 1.2 + Number.EPSILON) * 100) / 100))}
          >
            <ZoomIn size={20} />
          </button>
          <button
            type="button"
            className="media-lightbox-zoombtn icon-button"
            aria-label={t("mediaLightboxZoomOut")}
            onClick={() => setZoom((z) => Math.max(0.25, Math.round((z / 1.2 + Number.EPSILON) * 100) / 100))}
          >
            <ZoomOut size={20} />
          </button>
          <button
            type="button"
            className="media-lightbox-zoombtn icon-button"
            aria-label={t("mediaLightboxZoomReset")}
            onClick={() => setZoom(1)}
          >
            <RotateCcw size={20} />
          </button>
        </div>
      ) : null}
    </div>
  );

  return createPortal(layer, document.body);
}
