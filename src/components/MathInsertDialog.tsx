import katex from "katex";
import { useEffect, useMemo, useRef, useState } from "react";
import { ensureKatexStyles } from "../services/katexStyle";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";

export type MathInsertMode = "inline" | "block";

interface Props {
  open: boolean;
  /** 打开对话框时的公式类型（新建时可切换；编辑时固定） */
  initialKind: MathInsertMode;
  initialLatex: string;
  isEdit: boolean;
  onClose: () => void;
  onSubmit: (latex: string, kind: MathInsertMode) => void;
}

const PALETTE: { labelKey: string; items: { sym: string; latex: string }[] }[] = [
  {
    labelKey: "mathPaletteBasic",
    items: [
      { sym: "+", latex: "+" },
      { sym: "−", latex: "-" },
      { sym: "×", latex: "\\times " },
      { sym: "÷", latex: "\\div " },
      { sym: "=", latex: "=" },
      { sym: "≠", latex: "\\neq " },
      { sym: "<", latex: "<" },
      { sym: ">", latex: ">" },
      { sym: "≤", latex: "\\leq " },
      { sym: "≥", latex: "\\geq " },
      { sym: "±", latex: "\\pm " },
      { sym: "∞", latex: "\\infty " },
      { sym: "→", latex: "\\rightarrow " },
      { sym: "∑", latex: "\\sum " },
      { sym: "∫", latex: "\\int " },
      { sym: "√", latex: "\\sqrt{}" },
      { sym: "²", latex: "^2" },
      { sym: "( )", latex: "\\left( \\right)" }
    ]
  },
  {
    labelKey: "mathPaletteFrac",
    items: [
      { sym: "a/b", latex: "\\frac{a}{b}" },
      { sym: "√x", latex: "\\sqrt{x}" },
      { sym: "ⁿ√", latex: "\\sqrt[n]{x}" },
      { sym: "xⁿ", latex: "x^{n}" },
      { sym: "xₙ", latex: "x_{n}" },
      { sym: "ₙ", latex: "_{}" },
      { sym: "lim", latex: "\\lim_{x \\to 0} " },
      { sym: "Σᵢ", latex: "\\sum_{i=1}^{n} " },
      { sym: "∫ₐᵇ", latex: "\\int_{a}^{b} " }
    ]
  },
  {
    labelKey: "mathPaletteGreek",
    items: [
      { sym: "π", latex: "\\pi " },
      { sym: "θ", latex: "\\theta " },
      { sym: "α", latex: "\\alpha " },
      { sym: "β", latex: "\\beta " },
      { sym: "λ", latex: "\\lambda " },
      { sym: "γ", latex: "\\gamma " },
      { sym: "ψ", latex: "\\psi " },
      { sym: "Γ", latex: "\\Gamma " },
      { sym: "Δ", latex: "\\Delta " },
      { sym: "Θ", latex: "\\Theta " },
      { sym: "Λ", latex: "\\Lambda " },
      { sym: "Σ", latex: "\\Sigma " },
      { sym: "Ω", latex: "\\Omega " },
      { sym: "ω", latex: "\\omega " },
      { sym: "μ", latex: "\\mu " },
      { sym: "σ", latex: "\\sigma " },
      { sym: "φ", latex: "\\phi " },
      { sym: "ε", latex: "\\varepsilon " }
    ]
  }
];

export function MathInsertDialog({ open, initialKind, initialLatex, isEdit, onClose, onSubmit }: Props) {
  const { t } = useTranslation();
  const [latex, setLatex] = useState("");
  const [kind, setKind] = useState<MathInsertMode>("inline");
  const [paletteTab, setPaletteTab] = useState(0);
  const taRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!open) return;
    void ensureKatexStyles();
    setLatex(initialLatex);
    setKind(initialKind);
    setPaletteTab(0);
  }, [open, initialLatex, initialKind]);

  const previewHtml = useMemo(() => {
    const trimmed = latex.trim();
    if (!trimmed) return "";
    try {
      return katex.renderToString(trimmed, { throwOnError: false, displayMode: kind === "block" });
    } catch {
      return "";
    }
  }, [latex, kind]);

  if (!open) return null;

  function appendSnippet(snippet: string) {
    const ta = taRef.current;
    if (!ta) {
      setLatex((prev) => prev + snippet);
      return;
    }
    const start = ta.selectionStart ?? latex.length;
    const end = ta.selectionEnd ?? latex.length;
    const next = latex.slice(0, start) + snippet + latex.slice(end);
    setLatex(next);
    requestAnimationFrame(() => {
      ta.focus();
      const pos = start + snippet.length;
      ta.setSelectionRange(pos, pos);
    });
  }

  const title = isEdit ? t("dialogMathTitleEdit") : t("dialogMathTitleInsert");

  const dialog = (
    <div className="editor-dialog-layer" role="presentation">
      <div className="editor-dialog-mask" onClick={onClose} />
      <div
        className="editor-dialog editor-dialog--math"
        role="dialog"
        aria-labelledby="math-dialog-title"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <header className="editor-dialog-header">
          <h2 id="math-dialog-title">{title}</h2>
          <button type="button" className="ghost small" onClick={onClose}>
            {t("close")}
          </button>
        </header>
        {!isEdit ? (
          <div className="math-kind-toggle" role="group" aria-label={t("dialogMathKindGroupLabel")}>
            <button
              type="button"
              className={kind === "inline" ? "math-kind-toggle__btn active" : "math-kind-toggle__btn"}
              onClick={() => setKind("inline")}
            >
              {t("dialogMathKindInline")}
            </button>
            <button
              type="button"
              className={kind === "block" ? "math-kind-toggle__btn active" : "math-kind-toggle__btn"}
              onClick={() => setKind("block")}
            >
              {t("dialogMathKindBlock")}
            </button>
          </div>
        ) : (
          <p className="muted editor-dialog-hint editor-dialog-hint--tight math-edit-kind-hint">
            {initialKind === "inline" ? t("dialogMathKindInline") : t("dialogMathKindBlock")}
          </p>
        )}
        <p className="muted editor-dialog-hint editor-dialog-hint--tight">{t("dialogMathHint")}</p>
        <div className="editor-dialog-tabs">
          {PALETTE.map((p, i) => (
            <button key={p.labelKey} type="button" className={paletteTab === i ? "editor-dialog-tab active" : "editor-dialog-tab"} onClick={() => setPaletteTab(i)}>
              {t(p.labelKey)}
            </button>
          ))}
        </div>
        <div className="math-palette-grid">
          {PALETTE[paletteTab]?.items.map((item, j) => (
            <button key={`${paletteTab}-${j}`} type="button" className="math-palette-btn" title={item.latex} onClick={() => appendSnippet(item.latex)}>
              {item.sym}
            </button>
          ))}
        </div>
        <div className="editor-dialog-body">
          <label className="editor-dialog-field">
            <span>{t("dialogMathLatexLabel")}</span>
            <textarea ref={taRef} className="math-insert-textarea" rows={4} value={latex} onChange={(e) => setLatex(e.target.value)} spellCheck={false} />
          </label>
          <div className="math-preview-wrap">
            <span className="muted">{t("dialogMathPreview")}</span>
            <div className="math-preview">
              {previewHtml ? <span dangerouslySetInnerHTML={{ __html: previewHtml }} /> : <span className="muted">{t("dialogMathPreviewEmpty")}</span>}
            </div>
          </div>
        </div>
        <footer className="editor-dialog-footer">
          <button type="button" className="ghost" onClick={onClose}>
            {t("cancel")}
          </button>
          <button
            type="button"
            className="primary"
            disabled={!latex.trim()}
            onClick={() => latex.trim() && onSubmit(latex.trim(), isEdit ? initialKind : kind)}
          >
            {t("confirm")}
          </button>
        </footer>
      </div>
    </div>
  );

  return createPortal(dialog, document.body);
}
