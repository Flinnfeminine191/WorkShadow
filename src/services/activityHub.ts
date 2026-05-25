export type ActivityKind = "embedding" | "search" | "save" | "index" | "persist" | "vectorRebuild";

export type ActivityStatus = "running" | "done" | "error";

export interface ActivityTask {
  id: string;
  kind: ActivityKind;
  labelKey: string;
  detail?: string;
  status: ActivityStatus;
  error?: string;
  startedAt: number;
  endedAt?: number;
}

type Listener = () => void;

const DONE_VISIBLE_MS = 2800;
let tasks: ActivityTask[] = [];
const listeners = new Set<Listener>();
const pruneTimers = new Map<string, ReturnType<typeof setTimeout>>();

function notify() {
  for (const listener of [...listeners]) listener();
}

function pruneTask(id: string) {
  tasks = tasks.filter((t) => t.id !== id);
  pruneTimers.delete(id);
  notify();
}

function schedulePrune(id: string) {
  const existing = pruneTimers.get(id);
  if (existing) clearTimeout(existing);
  pruneTimers.set(
    id,
    setTimeout(() => {
      pruneTask(id);
    }, DONE_VISIBLE_MS)
  );
}

export function getActivityTasks(): ActivityTask[] {
  return tasks;
}

export function subscribeActivity(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function beginActivity(kind: ActivityKind, detail?: string): string {
  const existing = tasks.find((t) => t.status === "running" && t.kind === kind);
  if (existing) {
    if (detail && detail !== existing.detail) {
      tasks = tasks.map((t) => (t.id === existing.id ? { ...t, detail } : t));
      notify();
    }
    return existing.id;
  }

  const id = crypto.randomUUID();
  tasks = [
    ...tasks.filter((t) => t.status !== "running" || t.kind !== kind),
    {
      id,
      kind,
      labelKey: `activity.${kind}`,
      detail,
      status: "running",
      startedAt: Date.now()
    }
  ];
  notify();
  return id;
}

export function endActivity(id: string, error?: string) {
  const idx = tasks.findIndex((t) => t.id === id);
  if (idx === -1) return;
  const endedAt = Date.now();
  const next: ActivityTask = {
    ...tasks[idx],
    status: error ? "error" : "done",
    error,
    endedAt
  };
  tasks = [...tasks.slice(0, idx), next, ...tasks.slice(idx + 1)];
  notify();
  schedulePrune(id);
}

export function hasVisibleActivity(): boolean {
  return tasks.some((t) => t.status === "running" || (t.endedAt && Date.now() - t.endedAt < DONE_VISIBLE_MS));
}

export async function trackActivity<T>(kind: ActivityKind, fn: () => Promise<T>, detail?: string): Promise<T> {
  const id = beginActivity(kind, detail);
  try {
    const result = await fn();
    endActivity(id);
    return result;
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    endActivity(id, message);
    throw e;
  }
}
