import { describe, expect, it } from "vitest";
import { buildRagContextForQa, excerptsFromSearchResults, sourcesFromSearchResults, trimSearchResultsForQaContext } from "./logQa";
import type { LogNode, SearchResult } from "../types";

function result(logId: string, title: string, text: string, updatedAt: string, score = 1, chunkId = "c1"): SearchResult {
  return {
    logId,
    parentPath: title,
    score,
    matchCount: 1,
    node: { id: logId, parentId: null, title, kind: "log", createdAt: "", updatedAt, tiptapJson: {}, markdown: "" } as LogNode,
    hits: [
      {
        chunk: { id: chunkId, logId, text, timestamp: "", parentPath: title, position: 0, score },
        summaryParts: [{ text }]
      }
    ]
  };
}

describe("logQa", () => {
  it("buildRagContextForQa includes titles and paths", () => {
    const ctx = buildRagContextForQa([result("a", "Alpha", "body one", "")], 5000, 10000, true);
    expect(ctx).toContain("### Alpha");
    expect(ctx).toContain("body one");
  });

  it("sourcesFromSearchResults maps logs", () => {
    const nodes = [{ id: "x", parentId: null, title: "X log", kind: "log" as const, createdAt: "", updatedAt: "", tiptapJson: {}, markdown: "" }];
    const sources = sourcesFromSearchResults([result("x", "X log", "t", "")], nodes);
    expect(sources).toEqual([{ logId: "x", title: "X log", parentPath: "X log", matchCount: 1 }]);
  });

  it("excerptsFromSearchResults flattens hits with titles", () => {
    const excerpts = excerptsFromSearchResults([result("x", "X log", "excerpt body", "")]);
    expect(excerpts).toHaveLength(1);
    expect(excerpts[0]?.text).toContain("excerpt");
    expect(excerpts[0]?.title).toBe("X log");
  });

  it("trimSearchResultsForQaContext drops lower-ranked hits when over limit", () => {
    const low = result("low", "Low", "x".repeat(200), "", 0.1, "c-low");
    const high = result("high", "High", "y".repeat(200), "", 0.9, "c-high");
    const trimmed = trimSearchResultsForQaContext([low, high], 500, 280, true);
    const hitIds = trimmed.flatMap((r) => r.hits.map((h) => h.chunk.id));
    expect(hitIds).toContain("c-high");
    expect(hitIds).not.toContain("c-low");
  });

  it("sourcesFromSearchResults sorts by log updatedAt desc", () => {
    const nodes: LogNode[] = [
      { id: "a", parentId: null, title: "A", kind: "log", createdAt: "", updatedAt: "2020-01-01T00:00:00.000Z", tiptapJson: {}, markdown: "" },
      { id: "b", parentId: null, title: "B", kind: "log", createdAt: "", updatedAt: "2026-01-01T00:00:00.000Z", tiptapJson: {}, markdown: "" }
    ];
    const sources = sourcesFromSearchResults(
      [result("a", "A", "t", nodes[0].updatedAt), result("b", "B", "t", nodes[1].updatedAt)],
      nodes
    );
    expect(sources.map((s) => s.logId)).toEqual(["b", "a"]);
  });
});
