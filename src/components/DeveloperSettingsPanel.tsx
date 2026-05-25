import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { AppLogViewer } from "./AppLogViewer";
import { LanceDbViewer } from "./LanceDbViewer";
import { getAppDbDirectory, openAppDbDirectory } from "../services/appLogger";
import { reportErrorToUser, reportErrorWithRetry } from "../services/errorReporting";
import { isTauriRuntime } from "../services/storage";

export function DeveloperSettingsPanel() {
  const { t } = useTranslation();
  const [dbDir, setDbDir] = useState("");

  useEffect(() => {
    if (!isTauriRuntime()) return;
    void getAppDbDirectory().then(setDbDir).catch(() => setDbDir(""));
  }, []);

  return (
    <>
      <section className="settings-group settings-dev-sqlite" aria-labelledby="settings-group-dev-sqlite">
        <h2 id="settings-group-dev-sqlite" className="settings-group-title">
          {t("settingsDevSqliteTitle")}
        </h2>
        <p className="settings-field-hint muted">{t("settingsDevSqliteHint")}</p>
        {dbDir ? (
          <p className="settings-field-hint muted settings-dev-sqlite-dir" title={dbDir}>
            {t("settingsDevSqliteDir")}: {dbDir}
            <span className="settings-dev-sqlite-file"> / workshadow.db</span>
          </p>
        ) : null}
        <div className="settings-dev-error-btns">
          <button
            type="button"
            className="ghost"
            disabled={!isTauriRuntime()}
            title={isTauriRuntime() ? undefined : t("pathPickerDesktopOnly")}
            onClick={() => void openAppDbDirectory().catch((e) => reportErrorToUser("persist", e, { severity: "toast" }))}
          >
            {t("settingsDevSqliteOpenFolder")}
          </button>
        </div>
      </section>
      <LanceDbViewer />
      <AppLogViewer />
      <section className="settings-group settings-dev-error-test" aria-labelledby="settings-group-dev-errors">
        <h2 id="settings-group-dev-errors" className="settings-group-title">
          {t("settingsDevErrorUiTitle")}
        </h2>
        <p className="settings-field-hint muted">{t("settingsDevErrorUiHint")}</p>
        <div className="settings-dev-error-btns">
          <button
            type="button"
            className="ghost"
            onClick={() =>
              reportErrorToUser("index", new Error("Simulated: FlowRAG / network unreachable (dev test)"), { severity: "toast" })
            }
          >
            {t("settingsDevErrorToast")}
          </button>
          <button
            type="button"
            className="ghost"
            onClick={() => reportErrorToUser("persist", new Error("Simulated: database error: disk full (dev test)"))}
          >
            {t("settingsDevErrorModal")}
          </button>
          <button
            type="button"
            className="ghost"
            onClick={() =>
              reportErrorWithRetry("persist", new Error("Simulated: write failed (dev test)"), () => {
                reportErrorToUser("index", new Error("Retry callback ran (dev test)"), { severity: "toast" });
              })
            }
          >
            {t("settingsDevErrorRetry")}
          </button>
          <button type="button" className="ghost" onClick={() => reportErrorToUser("searchNotice", new Error("keyword-only"))}>
            {t("settingsDevWarningModal")}
          </button>
        </div>
      </section>
    </>
  );
}
