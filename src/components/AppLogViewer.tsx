import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  getAppLogDirectory,
  getAppLogPolicy,
  listAppLogFiles,
  openAppLogDirectory,
  readAppLogFile,
  type AppLogFileInfo,
  type AppLogPolicy
} from "../services/appLogger";
import { reportErrorToUser } from "../services/errorReporting";
import { isTauriRuntime } from "../services/storage";

export function AppLogViewer() {
  const { t } = useTranslation();
  const [files, setFiles] = useState<AppLogFileInfo[]>([]);
  const [selected, setSelected] = useState<string>("");
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(false);
  const [logDir, setLogDir] = useState("");
  const [policy, setPolicy] = useState<AppLogPolicy | null>(null);

  const refreshList = useCallback(async () => {
    setLoading(true);
    try {
      const [list, dir, pol] = await Promise.all([listAppLogFiles(), getAppLogDirectory(), getAppLogPolicy()]);
      setFiles(list);
      setLogDir(dir);
      setPolicy(pol);
      const next = selected && list.some((f) => f.name === selected) ? selected : list[0]?.name ?? "";
      setSelected(next);
    } catch (e) {
      reportErrorToUser("persist", e, { severity: "toast" });
    } finally {
      setLoading(false);
    }
  }, [selected]);

  const loadContent = useCallback(
    async (fileName: string) => {
      if (!fileName) {
        setContent("");
        return;
      }
      setLoading(true);
      try {
        const text = await readAppLogFile(fileName, 2500);
        setContent(text || t("settingsDevLogsEmpty"));
      } catch (e) {
        reportErrorToUser("persist", e, { severity: "toast" });
      } finally {
        setLoading(false);
      }
    },
    [t]
  );

  useEffect(() => {
    void refreshList();
  }, []);

  useEffect(() => {
    if (selected) void loadContent(selected);
    else setContent("");
  }, [selected, loadContent]);

  const policyHint = policy
    ? t("settingsDevLogsPolicy", {
        rotation: policy.rotation,
        maxMb: policy.maxFileBytes ? Math.round(policy.maxFileBytes / 1024 / 1024) : 0,
        days: policy.retentionDays,
        maxFiles: policy.maxLogFiles
      })
    : "";

  return (
    <section className="settings-group settings-dev-logs" aria-labelledby="settings-group-dev-logs">
      <h2 id="settings-group-dev-logs" className="settings-group-title">
        {t("settingsDevLogsTitle")}
      </h2>
      <p className="settings-field-hint muted">{t("settingsDevLogsHint")}</p>
      {policyHint ? <p className="settings-field-hint muted settings-dev-logs-policy">{policyHint}</p> : null}
      {logDir ? (
        <p className="settings-field-hint muted settings-dev-logs-dir" title={logDir}>
          {t("settingsDevLogsDir")}: {logDir}
        </p>
      ) : null}
      <div className="settings-dev-logs-toolbar">
        <label className="settings-dev-logs-select-wrap">
          <span className="settings-field-label">{t("settingsDevLogsFile")}</span>
          <select
            className="settings-dev-logs-select"
            value={selected}
            disabled={loading || files.length === 0}
            onChange={(e) => setSelected(e.target.value)}
          >
            {files.length === 0 ? <option value="">{t("settingsDevLogsNoFiles")}</option> : null}
            {files.map((f) => (
              <option key={f.name} value={f.name}>
                {f.name} ({Math.max(1, Math.round(f.sizeBytes / 1024))} KB)
              </option>
            ))}
          </select>
        </label>
        <div className="settings-dev-logs-actions">
          <button type="button" className="ghost small" disabled={loading} onClick={() => void refreshList()}>
            {t("settingsDevLogsRefresh")}
          </button>
          <button
            type="button"
            className="ghost small"
            disabled={!selected || loading}
            onClick={() => void loadContent(selected)}
          >
            {t("settingsDevLogsReload")}
          </button>
          {isTauriRuntime() ? (
            <button
              type="button"
              className="ghost small"
              onClick={() => void openAppLogDirectory().catch((e) => reportErrorToUser("persist", e, { severity: "toast" }))}
            >
              {t("settingsDevLogsOpenFolder")}
            </button>
          ) : null}
        </div>
      </div>
      <pre className="settings-dev-logs-view" aria-live="polite">
        {loading && !content ? t("settingsDevLogsLoading") : content}
      </pre>
    </section>
  );
}
