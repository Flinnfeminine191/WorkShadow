import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";

export type LinkDialogMode = "urlOnly" | "textAndUrl";

interface Props {
  open: boolean;
  mode: LinkDialogMode;
  initialHref?: string;
  onClose: () => void;
  onConfirm: (payload: { href: string; linkText?: string }) => void;
}

export function LinkInsertDialog({ open, mode, initialHref = "", onClose, onConfirm }: Props) {
  const { t } = useTranslation();
  const [href, setHref] = useState("");
  const [linkText, setLinkText] = useState("");
  const hrefRef = useRef<HTMLInputElement>(null);
  const textRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) {
      setHref("");
      setLinkText("");
      return;
    }
    setHref(initialHref);
    setLinkText("");
  }, [open, initialHref]);

  useEffect(() => {
    if (!open) return;
    const id = requestAnimationFrame(() => {
      if (mode === "textAndUrl") {
        textRef.current?.focus();
      } else {
        hrefRef.current?.focus();
        hrefRef.current?.select();
      }
    });
    return () => cancelAnimationFrame(id);
  }, [open, mode]);

  if (!open) return null;

  const canSubmit = href.trim().length > 0;

  const dialog = (
    <div className="editor-dialog-layer" role="presentation">
      <div className="editor-dialog-mask" onClick={onClose} />
      <div
        className="editor-dialog editor-dialog--narrow"
        role="dialog"
        aria-labelledby="link-dialog-title"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <header className="editor-dialog-header">
          <h2 id="link-dialog-title">{t("dialogLinkTitle")}</h2>
          <button type="button" className="ghost small" onClick={onClose}>
            {t("close")}
          </button>
        </header>
        <div className="editor-dialog-body">
          {mode === "textAndUrl" ? (
            <label className="editor-dialog-field">
              <span>{t("dialogLinkTextLabel")}</span>
              <input ref={textRef} value={linkText} onChange={(e) => setLinkText(e.target.value)} placeholder={t("dialogLinkTextPlaceholder")} />
            </label>
          ) : null}
          <label className="editor-dialog-field">
            <span>{t("dialogLinkUrlLabel")}</span>
            <input
              ref={hrefRef}
              value={href}
              onChange={(e) => setHref(e.target.value)}
              placeholder="https://..."
              autoComplete="url"
              inputMode="url"
            />
          </label>
        </div>
        <footer className="editor-dialog-footer">
          <button type="button" className="ghost" onClick={onClose}>
            {t("cancel")}
          </button>
          <button
            type="button"
            className="primary"
            disabled={!canSubmit}
            onClick={() => {
              if (!canSubmit) return;
              if (mode === "urlOnly") onConfirm({ href: href.trim() });
              else onConfirm({ href: href.trim(), linkText: linkText.trim() });
            }}
          >
            {t("confirm")}
          </button>
        </footer>
      </div>
    </div>
  );

  return createPortal(dialog, document.body);
}
