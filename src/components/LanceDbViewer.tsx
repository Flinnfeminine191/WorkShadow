import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  inspectLanceDb,
  openLanceDbDirectory,
  type RagInspectResponse,
  type RagInspectRow
} from "../services/lanceInspect";
import { reportErrorToUser } from "../services/errorReporting";
import { isTauriRuntime } from "../services/storage";

const PAGE_SIZE = 40;

function textPreview(text: string, max = 120) {
  const flat = text.replace(/\s+/g, " ").trim();
  if (flat.length <= max) return flat;
  return `${flat.slice(0, max)}…`;
}

export function LanceDbViewer() {
  const { t } = useTranslation();
  const [data, setData] = useState<RagInspectResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [offset, setOffset] = useState(0);
  const [logIdFilter, setLogIdFilter] = useState("");
  const [includeVectorPreview, setIncludeVectorPreview] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!isTauriRuntime()) return;
    setLoading(true);
    try {
      const res = await inspectLanceDb({
        limit: PAGE_SIZE,
        offset,
        logIdFilter: logIdFilter.trim() || null,
        includeVectorPreview
      });
      setData(res);
      setExpandedId(null);
    } catch (e) {
      reportErrorToUser("index", e, { severity: "toast" });
    } finally {
      setLoading(false);
    }
  }, [offset, logIdFilter, includeVectorPreview]);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = data?.filteredRows ?? 0;
  const pageCount = Math.max(1, Math.ceil(filtered / PAGE_SIZE));
  const pageIndex = Math.floor(offset / PAGE_SIZE) + 1;
  const canPrev = offset > 0;
  const canNext = offset + PAGE_SIZE < filtered;

  function applyLogFilter(logId: string) {
    setLogIdFilter(logId);
    setOffset(0);
  }

  function clearLogFilter() {
    setLogIdFilter("");
    setOffset(0);
  }

  return (
    <section className="settings-group settings-dev-lance" aria-labelledby="settings-group-dev-lance">
      <h2 id="settings-group-dev-lance" className="settings-group-title">
        {t("settingsDevLanceTitle")}
      </h2>
      <p className="settings-field-hint muted">{t("settingsDevLanceHint")}</p>

      {data?.directory ? (
        <p className="settings-field-hint muted settings-dev-lance-dir" title={data.directory}>
          {t("settingsDevLanceDir")}: {data.directory}
        </p>
      ) : null}

      <div className="settings-dev-lance-summary">
        <div className="settings-dev-lance-stat">
          <span className="settings-dev-lance-stat-label">{t("settingsDevLanceTable")}</span>
          <span className="settings-dev-lance-stat-value">{data?.tableName ?? "log_chunks"}</span>
        </div>
        <div className="settings-dev-lance-stat">
          <span className="settings-dev-lance-stat-label">{t("settingsDevLanceTotalRows")}</span>
          <span className="settings-dev-lance-stat-value">{data?.totalRows ?? "—"}</span>
        </div>
        <div className="settings-dev-lance-stat">
          <span className="settings-dev-lance-stat-label">{t("settingsDevLanceFilteredRows")}</span>
          <span className="settings-dev-lance-stat-value">{data?.filteredRows ?? "—"}</span>
        </div>
        {data?.meta ? (
          <div className="settings-dev-lance-stat settings-dev-lance-stat--wide">
            <span className="settings-dev-lance-stat-label">{t("settingsDevLanceEmbedding")}</span>
            <span className="settings-dev-lance-stat-value" title={data.meta.embeddingModel}>
              {data.meta.embeddingModel} · dim {data.meta.embeddingDim} · {data.meta.vectorMetric}
            </span>
          </div>
        ) : null}
      </div>

      {data?.warning ? <p className="settings-dev-lance-warning" role="status">{data.warning}</p> : null}

      {!data?.exists && data && !loading ? (
        <p className="settings-field-hint muted">{t("settingsDevLanceEmpty")}</p>
      ) : null}

      {data && data.logStats.length > 0 ? (
        <div className="settings-dev-lance-log-stats">
          <h3 className="settings-dev-lance-subtitle">{t("settingsDevLanceLogStats")}</h3>
          <div className="settings-dev-lance-chips">
            {logIdFilter ? (
              <button type="button" className="settings-dev-lance-chip is-active" onClick={clearLogFilter}>
                {t("settingsDevLanceClearFilter")} ({logIdFilter})
              </button>
            ) : null}
            {data.logStats.map((s) => (
              <button
                key={s.logId}
                type="button"
                className={`settings-dev-lance-chip${logIdFilter === s.logId ? " is-active" : ""}`}
                onClick={() => applyLogFilter(s.logId)}
                title={s.logId}
              >
                {textPreview(s.logId, 28)} <span className="muted">({s.chunkCount})</span>
              </button>
            ))}
          </div>
        </div>
      ) : null}

      <div className="settings-dev-lance-toolbar">
        <label className="settings-dev-lance-filter">
          <span className="settings-field-label">{t("settingsDevLanceFilterLogId")}</span>
          <input
            type="text"
            value={logIdFilter}
            placeholder={t("settingsDevLanceFilterPlaceholder")}
            onChange={(e) => {
              setLogIdFilter(e.target.value);
              setOffset(0);
            }}
          />
        </label>
        <label className="settings-dev-lance-check">
          <input
            type="checkbox"
            checked={includeVectorPreview}
            onChange={(e) => {
              setIncludeVectorPreview(e.target.checked);
              setOffset(0);
            }}
          />
          {t("settingsDevLanceVectorPreview")}
        </label>
        <div className="settings-dev-lance-actions">
          <button type="button" className="ghost small" disabled={loading} onClick={() => void load()}>
            {t("settingsDevLogsRefresh")}
          </button>
          {isTauriRuntime() ? (
            <button
              type="button"
              className="ghost small"
              onClick={() => void openLanceDbDirectory().catch((e) => reportErrorToUser("persist", e, { severity: "toast" }))}
            >
              {t("settingsDevLanceOpenFolder")}
            </button>
          ) : null}
        </div>
      </div>

      {data && data.rows.length > 0 ? (
        <>
          <div className="settings-dev-lance-table-wrap">
            <table className="settings-dev-lance-table">
              <thead>
                <tr>
                  <th>{t("settingsDevLanceColLog")}</th>
                  <th>{t("settingsDevLanceColPos")}</th>
                  <th>{t("settingsDevLanceColPath")}</th>
                  <th>{t("settingsDevLanceColText")}</th>
                  <th>{t("settingsDevLanceColVector")}</th>
                </tr>
              </thead>
              <tbody>
                {data.rows.map((row) => (
                  <LanceRowTableRow
                    key={row.id}
                    row={row}
                    expanded={expandedId === row.id}
                    onToggle={() => setExpandedId((cur) => (cur === row.id ? null : row.id))}
                  />
                ))}
              </tbody>
            </table>
          </div>
          <div className="settings-dev-lance-pager">
            <button type="button" className="ghost small" disabled={!canPrev || loading} onClick={() => setOffset((o) => Math.max(0, o - PAGE_SIZE))}>
              {t("settingsDevLancePrev")}
            </button>
            <span className="settings-dev-lance-pager-info">
              {t("settingsDevLancePage", { page: pageIndex, pages: pageCount })}
            </span>
            <button type="button" className="ghost small" disabled={!canNext || loading} onClick={() => setOffset((o) => o + PAGE_SIZE)}>
              {t("settingsDevLanceNext")}
            </button>
          </div>
        </>
      ) : null}

      {data?.exists && !loading && data.rows.length === 0 && !data.warning ? (
        <p className="settings-field-hint muted">{t("settingsDevLanceNoRows")}</p>
      ) : null}
    </section>
  );
}

function LanceRowTableRow({
  row,
  expanded,
  onToggle
}: {
  row: RagInspectRow;
  expanded: boolean;
  onToggle: () => void;
}) {
  return (
    <>
      <tr className={`settings-dev-lance-row${expanded ? " is-expanded" : ""}`} onClick={onToggle}>
        <td title={row.logId}>{textPreview(row.logId, 16)}</td>
        <td>{row.position}</td>
        <td title={row.parentPath}>{textPreview(row.parentPath, 24)}</td>
        <td title={row.text}>{textPreview(row.text, 48)}</td>
        <td className="settings-dev-lance-vector" title={row.vectorPreview}>
          {row.vectorPreview}
        </td>
      </tr>
      {expanded ? (
        <tr className="settings-dev-lance-detail">
          <td colSpan={5}>
            <dl className="settings-dev-lance-detail-grid">
              <div>
                <dt>id</dt>
                <dd>{row.id}</dd>
              </div>
              <div>
                <dt>contentHash</dt>
                <dd>{row.contentHash}</dd>
              </div>
              <div>
                <dt>timestamp</dt>
                <dd>{row.timestamp}</dd>
              </div>
              <div>
                <dt>embedding</dt>
                <dd>
                  {row.embeddingModel} · dim {row.embeddingDim} · ‖v‖={row.vectorL2Norm.toFixed(4)}
                </dd>
              </div>
              <div className="settings-dev-lance-detail-full">
                <dt>text</dt>
                <dd>
                  <pre>{row.text}</pre>
                </dd>
              </div>
              <div className="settings-dev-lance-detail-full">
                <dt>vector</dt>
                <dd>
                  <pre>{row.vectorPreview}</pre>
                </dd>
              </div>
            </dl>
          </td>
        </tr>
      ) : null}
    </>
  );
}
