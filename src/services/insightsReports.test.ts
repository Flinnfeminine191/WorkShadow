import { describe, expect, it } from "vitest";
import { buildLogSummaryUserMessage, collectLogsByIds } from "./insightsReports";
import type { LogNode } from "../types";

function log(id: string, title: string): LogNode {
  return {
    id,
    parentId: null,
    title,
    kind: "log",
    createdAt: "",
    updatedAt: "",
    tiptapJson: {},
    markdown: `# ${title}`
  };
}

describe("buildLogSummaryUserMessage", () => {
  it("orders memory before preferences before logs", () => {
    const user = buildLogSummaryUserMessage(true, {
      memory: "MEM",
      preferences: "## 写作偏好\n侧重里程碑",
      logDigest: "LOG",
      logCount: 2
    });
    const memIdx = user.indexOf("长期记忆");
    const prefIdx = user.indexOf("写作偏好");
    const logIdx = user.indexOf("所选日志摘录");
    const taskIdx = user.indexOf("任务：");
    expect(memIdx).toBeLessThan(prefIdx);
    expect(prefIdx).toBeLessThan(logIdx);
    expect(logIdx).toBeLessThan(taskIdx);
  });

  it("uses English section headings when locale is en", () => {
    const user = buildLogSummaryUserMessage(false, {
      memory: "M",
      preferences: "",
      logDigest: "L",
      logCount: 1
    });
    expect(user).toContain("## Memory notes");
    expect(user).toContain("## Selected log excerpts");
    expect(user).not.toContain("长期记忆");
  });
});

describe("collectLogsByIds", () => {
  const nodes: LogNode[] = [log("a", "A"), log("b", "B"), log("c", "C")];

  it("returns only selected logs in selection order", () => {
    const picked = collectLogsByIds(nodes, ["c", "a"]);
    expect(picked.map((n) => n.id)).toEqual(["c", "a"]);
  });

  it("ignores unknown ids and folders", () => {
    const withFolder: LogNode[] = [
      ...nodes,
      { ...log("f", "F"), kind: "folder" }
    ];
    expect(collectLogsByIds(withFolder, ["a", "missing", "f"]).map((n) => n.id)).toEqual(["a"]);
  });
});
