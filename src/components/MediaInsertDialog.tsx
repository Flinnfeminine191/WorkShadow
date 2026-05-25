import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";

type MediaKind = "image" | "video";

interface Props {
  kind: MediaKind;
  open: boolean;
  onClose: () => void;
  /** caption 展示在图/视频下方；可为空 */
  onConfirm: (src: string, caption: string, kind: MediaKind) => void;
}

export function MediaInsertDialog({ kind, open, onClose, onConfirm }: Props) {
  const { t } = useTranslation();
  const [tab, setTab] = useState<"file" | "url">("file");
  const [url, setUrl] = useState("");
  const [caption, setCaption] = useState("");
  const [pendingDataUrl, setPendingDataUrl] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) {
      setUrl("");
      setCaption("");
      setTab("file");
      setPendingDataUrl(null);
      return;
    }
    setUrl("");
    setCaption("");
    setTab("file");
    setPendingDataUrl(null);
  }, [open, kind]);

  if (!open) return null;

  const accept = kind === "image" ? "image/*" : "video/*";
  const title = kind === "image" ? t("dialogMediaImageTitle") : t("dialogMediaVideoTitle");
  const captionLabel = kind === "image" ? t("dialogMediaImageCaptionBelow") : t("dialogMediaVideoCaptionBelow");
  const captionPlaceholder =
    kind === "image" ? t("dialogMediaImageCaptionPlaceholder") : t("dialogMediaVideoCaptionPlaceholder");

  const canConfirm = tab === "url" ? url.trim().length > 0 : pendingDataUrl !== null;

  function readFileAsDataUrl(file: File) {
    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === "string" ? reader.result : "";
      if (result) setPendingDataUrl(result);
    };
    reader.onerror = () => setPendingDataUrl(null);
    reader.readAsDataURL(file);
  }

  function submit() {
    if (tab === "url") {
      if (!url.trim()) return;
      onConfirm(url.trim(), caption.trim(), kind);
    } else {
      if (!pendingDataUrl) return;
      onConfirm(pendingDataUrl, caption.trim(), kind);
    }
    onClose();
  }

  const dialog = (
    <div className="editor-dialog-layer" role="presentation">
      <div className="editor-dialog-mask" onClick={onClose} />
      <div
        className="editor-dialog"
        role="dialog"
        aria-labelledby="media-dialog-title"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <header className="editor-dialog-header">
          <h2 id="media-dialog-title">{title}</h2>
          <button type="button" className="ghost small" onClick={onClose}>
            {t("close")}
          </button>
        </header>
        <div className="editor-dialog-tabs">
          <button
            type="button"
            className={tab === "file" ? "editor-dialog-tab active" : "editor-dialog-tab"}
            onClick={() => {
              setTab("file");
            }}
          >
            {t("dialogMediaTabFile")}
          </button>
          <button
            type="button"
            className={tab === "url" ? "editor-dialog-tab active" : "editor-dialog-tab"}
            onClick={() => {
              setTab("url");
              setPendingDataUrl(null);
            }}
          >
            {t("dialogMediaTabUrl")}
          </button>
        </div>
        <div className="editor-dialog-body">
          {tab === "file" ? (
            <>
              {kind === "video" ? <p className="muted editor-dialog-hint">{t("dialogMediaFileHint")}</p> : null}
              <input
                ref={fileRef}
                type="file"
                accept={accept}
                className="editor-dialog-file-input"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  e.target.value = "";
                  if (!file) return;
                  readFileAsDataUrl(file);
                }}
              />
              {!pendingDataUrl ? (
                <button type="button" className="primary" onClick={() => fileRef.current?.click()}>
                  {t("dialogMediaChooseFile")}
                </button>
              ) : (
                <div className="editor-dialog-file-preview">
                  {kind === "image" ? (
                    <img src={pendingDataUrl} alt="" className="editor-dialog-preview-media" />
                  ) : (
                    <video src={pendingDataUrl} controls className="editor-dialog-preview-media" />
                  )}
                  <button
                    type="button"
                    className="ghost"
                    onClick={() => {
                      setPendingDataUrl(null);
                      fileRef.current?.click();
                    }}
                  >
                    {t("dialogMediaRechooseFile")}
                  </button>
                </div>
              )}
            </>
          ) : (
            <label className="editor-dialog-field">
              <span>{t("dialogMediaUrlLabel")}</span>
              <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://..." autoFocus />
            </label>
          )}
          <label className="editor-dialog-field editor-dialog-field--caption">
            <span>{captionLabel}</span>
            <input value={caption} onChange={(e) => setCaption(e.target.value)} placeholder={captionPlaceholder} />
          </label>
        </div>
        <footer className="editor-dialog-footer">
          <button type="button" className="ghost" onClick={onClose}>
            {t("cancel")}
          </button>
          <button type="button" className="primary" disabled={!canConfirm} onClick={() => void submit()}>
            {t("confirm")}
          </button>
        </footer>
      </div>
    </div>
  );

  return createPortal(dialog, document.body);
}
