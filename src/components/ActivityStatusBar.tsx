import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { CheckCircle2, ChevronDown, CircleAlert, Loader2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useActivityHub } from "../hooks/useActivityHub";
import type { ActivityTask } from "../services/activityHub";

const DONE_VISIBLE_MS = 2800;

function getOverlayRoot(): HTMLElement {
  return document.getElementById("workshadow-overlays") ?? document.body;
}

function isTaskVisible(task: ActivityTask, now: number) {
  if (task.status === "running") return true;
  if (!task.endedAt) return false;
  return now - task.endedAt < DONE_VISIBLE_MS;
}

function statusIcon(task: ActivityTask) {
  if (task.status === "running") return <Loader2 size={14} className="activity-status__spin" aria-hidden />;
  if (task.status === "error") return <CircleAlert size={14} aria-hidden />;
  return <CheckCircle2 size={14} aria-hidden />;
}

export function ActivityStatusBar() {
  const { t } = useTranslation();
  const tasks = useActivityHub();
  const [expanded, setExpanded] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 400);
    return () => window.clearInterval(timer);
  }, []);

  const visible = tasks.filter((task) => isTaskVisible(task, now));
  if (visible.length === 0) return null;

  const running = visible.filter((task) => task.status === "running");
  const headline = running[0] ?? visible[0];
  const headlineLabel = t(headline.labelKey);

  function handleBlur(e: React.FocusEvent) {
    const next = e.relatedTarget as Node | null;
    if (next && rootRef.current?.contains(next)) return;
    setExpanded(false);
  }

  return createPortal(
    <div className="activity-status-dock" aria-live="polite">
      <div
        ref={rootRef}
        className={`activity-status${expanded ? " is-expanded" : " is-compact"}`}
        tabIndex={-1}
        onBlur={handleBlur}
      >
        <button
          type="button"
          className="activity-status__chip"
          aria-expanded={expanded}
          onClick={() => setExpanded((v) => !v)}
        >
          <span className="activity-status__chip-icon">{statusIcon(headline)}</span>
          <span className="activity-status__chip-text">
            {expanded ? t("activity.panelTitle") : headlineLabel}
            {!expanded && running.length > 1 ? (
              <span className="activity-status__chip-badge">+{running.length - 1}</span>
            ) : null}
          </span>
          <ChevronDown size={14} className="activity-status__chevron" aria-hidden />
        </button>
        {expanded ? (
          <div className="activity-status__panel" role="status">
            <p className="activity-status__panel-title">{t("activity.panelTitle")}</p>
            <ul className="activity-status__list">
              {visible.map((task) => (
                <li key={task.id} className={`activity-status__item activity-status__item--${task.status}`}>
                  <span className="activity-status__item-icon">{statusIcon(task)}</span>
                  <span className="activity-status__item-body">
                    <span className="activity-status__item-label">{t(task.labelKey)}</span>
                    {task.detail ? <span className="activity-status__item-detail">{task.detail}</span> : null}
                    {task.error ? <span className="activity-status__item-error">{task.error}</span> : null}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    </div>,
    getOverlayRoot()
  );
}
