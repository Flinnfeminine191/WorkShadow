import { describe, expect, it } from "vitest";
import { hashMarkdownForIndex, splitMarkdownToBlocks, splitMarkdownIntoChunks } from "./markdown";

describe("splitMarkdownToBlocks", () => {
  it("splits on ATX headings", () => {
    const md = "# One\nbody1\n## Two\nbody2";
    const blocks = splitMarkdownToBlocks(md);
    expect(blocks.length).toBeGreaterThanOrEqual(2);
    expect(blocks.some((b) => b.includes("body1"))).toBe(true);
    expect(blocks.some((b) => b.includes("body2"))).toBe(true);
  });

  it("returns empty for blank", () => {
    expect(splitMarkdownToBlocks("   \n")).toEqual([]);
  });

  it("slices oversized sections", () => {
    const para = "x".repeat(5000);
    const blocks = splitMarkdownToBlocks(`${para}\n\n${para}`);
    expect(blocks.every((b) => b.length <= 3600)).toBe(true);
  });
});

describe("hashMarkdownForIndex", () => {
  it("changes when content changes", () => {
    expect(hashMarkdownForIndex("a")).not.toBe(hashMarkdownForIndex("b"));
  });
});

describe("splitMarkdownIntoChunks", () => {
  it("assigns sequential ids", () => {
    const chunks = splitMarkdownIntoChunks("# A\n\none\n\n# B\n\ntwo", "log1", "P");
    expect(chunks.length).toBeGreaterThanOrEqual(2);
    expect(chunks.map((c) => c.id)).toEqual(chunks.map((_, i) => `log1:${i}`));
  });
});
