import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";

type RGB = { r: number; g: number; b: number };

function clamp255(n: number) {
  return Math.max(0, Math.min(255, Math.round(n)));
}

function rgbToHex(r: number, g: number, b: number) {
  return `#${[r, g, b].map((x) => clamp255(x).toString(16).padStart(2, "0")).join("")}`;
}

function hexToRgb(hex: string): RGB | null {
  const s = hex.trim();
  if (!/^#[0-9a-fA-F]{6}$/.test(s)) return null;
  return {
    r: parseInt(s.slice(1, 3), 16),
    g: parseInt(s.slice(3, 5), 16),
    b: parseInt(s.slice(5, 7), 16)
  };
}

function rgbToHsv(r: number, g: number, b: number) {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const d = max - min;
  let h = 0;
  if (d > 1e-6) {
    if (max === rn) h = ((gn - bn) / d + (gn < bn ? 6 : 0)) * 60;
    else if (max === gn) h = ((bn - rn) / d + 2) * 60;
    else h = ((rn - gn) / d + 4) * 60;
  }
  const s = max < 1e-6 ? 0 : d / max;
  const v = max;
  return { h, s, v };
}

function hsvToRgb(h: number, s: number, v: number): RGB {
  const hh = ((h % 360) + 360) % 360;
  const c = v * s;
  const x = c * (1 - Math.abs(((hh / 60) % 2) - 1));
  const m = v - c;
  let rp = 0;
  let gp = 0;
  let bp = 0;
  if (hh < 60) [rp, gp, bp] = [c, x, 0];
  else if (hh < 120) [rp, gp, bp] = [x, c, 0];
  else if (hh < 180) [rp, gp, bp] = [0, c, x];
  else if (hh < 240) [rp, gp, bp] = [0, x, c];
  else if (hh < 300) [rp, gp, bp] = [x, 0, c];
  else [rp, gp, bp] = [c, 0, x];
  return {
    r: Math.round((rp + m) * 255),
    g: Math.round((gp + m) * 255),
    b: Math.round((bp + m) * 255)
  };
}

function parseHexLoose(input: string): string | null {
  const t = input.trim();
  if (/^#[0-9a-fA-F]{6}$/.test(t)) return t.toLowerCase();
  return null;
}

interface Props {
  open: boolean;
  initialHex: string;
  onClose: () => void;
  onConfirm: (hex: string) => void;
  titleKey?: string;
  headerId?: string;
  /** 高亮取色：预览色块等去掉描边，避免浅底色上显得脏 */
  variant?: "text" | "highlight";
}

export function TextColorDialog({
  open,
  initialHex,
  onClose,
  onConfirm,
  titleKey = "dialogTextColorTitle",
  headerId = "text-color-dialog-title",
  variant = "text"
}: Props) {
  const { t } = useTranslation();
  const [r, setR] = useState(37);
  const [g, setG] = useState(99);
  const [b, setB] = useState(235);
  const [hexFocused, setHexFocused] = useState(false);
  const [hexBuffer, setHexBuffer] = useState("#2563eb");

  const hex = rgbToHex(r, g, b);

  useEffect(() => {
    if (!open) return;
    const parsed = parseHexLoose(initialHex);
    if (parsed) {
      const rgb = hexToRgb(parsed)!;
      setR(rgb.r);
      setG(rgb.g);
      setB(rgb.b);
      setHexBuffer(parsed);
    } else {
      setR(24);
      setG(24);
      setB(27);
      setHexBuffer("#111827");
    }
    setHexFocused(false);
  }, [open, initialHex]);

  const setFromHsv = useCallback((nh: number, ns: number, nv: number) => {
    const next = hsvToRgb(nh, ns, nv);
    setR(next.r);
    setG(next.g);
    setB(next.b);
  }, []);

  const pickSvFromClient = useCallback(
    (clientX: number, clientY: number, el: HTMLDivElement, curH: number) => {
      const rect = el.getBoundingClientRect();
      const x = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
      const y = Math.max(0, Math.min(1, (clientY - rect.top) / rect.height));
      setFromHsv(curH, x, 1 - y);
    },
    [setFromHsv]
  );

  if (!open) return null;

  const { h, s, v } = rgbToHsv(r, g, b);
  const pureHue = `hsl(${Math.round(h)}, 100%, 50%)`;
  const svBg = `linear-gradient(to top, #000, transparent), linear-gradient(to right, #fff, ${pureHue})`;

  const onSvMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    e.preventDefault();
    const el = e.currentTarget;
    const { h: ch } = rgbToHsv(r, g, b);
    pickSvFromClient(e.clientX, e.clientY, el, ch);
    const onMove = (ev: MouseEvent) => {
      pickSvFromClient(ev.clientX, ev.clientY, el, ch);
    };
    const onUp = () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  };

  const dialog = (
    <div className="editor-dialog-layer" role="presentation">
      <div className="editor-dialog-mask" onClick={onClose} />
      <div
        className={["editor-dialog", "editor-dialog--color", variant === "highlight" ? "editor-dialog--color-highlight" : ""]
          .filter(Boolean)
          .join(" ")}
        role="dialog"
        aria-labelledby={headerId}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <header className="editor-dialog-header">
          <h2 id={headerId}>{t(titleKey)}</h2>
          <button type="button" className="ghost small" onClick={onClose}>
            {t("close")}
          </button>
        </header>
        <div className="editor-dialog-body text-color-dialog-body">
          <div className="text-color-picker">
            <div
              className="text-color-picker__sv"
              style={{ background: svBg }}
              role="application"
              aria-label={t("dialogTextColorPickerPlane")}
              tabIndex={0}
              onMouseDown={onSvMouseDown}
            >
              <span
                className="text-color-picker__sv-knob"
                style={{ left: `${s * 100}%`, top: `${(1 - v) * 100}%` }}
                aria-hidden
              />
            </div>
            <label className="text-color-picker__hue-label">
              <span className="visually-hidden">{t("dialogTextColorHue")}</span>
              <input
                type="range"
                className="text-color-picker__hue"
                min={0}
                max={360}
                step={1}
                value={Math.round(h)}
                onChange={(e) => {
                  const nh = Number(e.target.value);
                  const { s: cs, v: cv } = rgbToHsv(r, g, b);
                  setFromHsv(nh, cs, cv);
                }}
              />
            </label>
            <div className="text-color-picker__rgbhex">
              <label className="text-color-picker__field">
                <span>R</span>
                <input
                  type="number"
                  min={0}
                  max={255}
                  value={r}
                  onChange={(e) => {
                    const n = Number(e.target.value);
                    if (Number.isNaN(n)) return;
                    setR(clamp255(n));
                  }}
                />
              </label>
              <label className="text-color-picker__field">
                <span>G</span>
                <input
                  type="number"
                  min={0}
                  max={255}
                  value={g}
                  onChange={(e) => {
                    const n = Number(e.target.value);
                    if (Number.isNaN(n)) return;
                    setG(clamp255(n));
                  }}
                />
              </label>
              <label className="text-color-picker__field">
                <span>B</span>
                <input
                  type="number"
                  min={0}
                  max={255}
                  value={b}
                  onChange={(e) => {
                    const n = Number(e.target.value);
                    if (Number.isNaN(n)) return;
                    setB(clamp255(n));
                  }}
                />
              </label>
              <label className="text-color-picker__field text-color-picker__field--hex">
                <span>{t("dialogTextColorHex")}</span>
                <input
                  type="text"
                  value={hexFocused ? hexBuffer : hex}
                  onFocus={() => {
                    setHexFocused(true);
                    setHexBuffer(hex);
                  }}
                  onChange={(e) => setHexBuffer(e.target.value)}
                  onBlur={() => {
                    const p = parseHexLoose(hexBuffer);
                    if (p) {
                      const rgb = hexToRgb(p)!;
                      setR(rgb.r);
                      setG(rgb.g);
                      setB(rgb.b);
                    }
                    setHexFocused(false);
                  }}
                  spellCheck={false}
                  autoComplete="off"
                />
              </label>
            </div>
            <div className="text-color-picker__preview-row">
              <span className="text-color-picker__preview-label">{t("dialogTextColorPreview")}</span>
              <span className="text-color-picker__preview-swatch" style={{ backgroundColor: hex }} title={hex} />
              <code className="text-color-picker__preview-code">
                RGB({r}, {g}, {b}) · {hex}
              </code>
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
            onClick={() => {
              onConfirm(hex);
              onClose();
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
