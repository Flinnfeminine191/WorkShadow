import { useTranslation } from "react-i18next";
import type { ConfirmOptions } from "../types";

interface Props {
  options: ConfirmOptions | null;
  onClose: (confirmed: boolean) => void;
}

export function ConfirmDialog({ options, onClose }: Props) {
  const { t } = useTranslation();
  if (!options) return null;

  return (
    <div className="modal-backdrop">
      <section className="modal-card">
        <h2>{options.title}</h2>
        <p>{options.message}</p>
        <div className="modal-actions">
          <button type="button" className="ghost" onClick={() => onClose(false)}>
            {t("cancel")}
          </button>
          <button type="button" className={options.danger ? "danger" : "primary"} onClick={() => onClose(true)}>
            {t("confirm")}
          </button>
        </div>
      </section>
    </div>
  );
}
