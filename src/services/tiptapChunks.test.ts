import { describe, expect, it } from "vitest";
import type { LogNode } from "../types";
import { paragraphBoldSectionLabel, splitTiptapIntoChunks, splitTiptapToBlocks } from "./tiptapChunks";

const node = (tiptapJson: unknown): LogNode => ({
  id: "log1",
  parentId: null,
  title: "Log",
  kind: "log",
  createdAt: "c",
  updatedAt: "u",
  markdown: "",
  tiptapJson
});

describe("splitTiptapToBlocks", () => {
  it("splits sections on headings", () => {
    const blocks = splitTiptapToBlocks({
      type: "doc",
      content: [
        { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "第一段" }] },
        { type: "paragraph", content: [{ type: "text", text: "正文 A" }] },
        { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "第二段" }] },
        { type: "paragraph", content: [{ type: "text", text: "正文 B" }] }
      ]
    });

    expect(blocks).toHaveLength(2);
    expect(blocks[0]).toContain("## 第一段");
    expect(blocks[1]).toContain("## 第二段");
  });

  it("keeps media captions but skips media sources and annotations", () => {
    const blocks = splitTiptapToBlocks({
      type: "doc",
      content: [
        { type: "paragraph", content: [{ type: "text", text: "开头" }] },
        { type: "image", attrs: { src: "file:///secret.png", caption: "架构草图", aiAnnotation: "不应进入索引" } },
        { type: "video", attrs: { src: "https://example.com/video", caption: "演示视频" } }
      ]
    });

    const text = blocks.join("\n");
    expect(text).toContain("开头");
    expect(text).toContain("媒体标题：架构草图");
    expect(text).toContain("媒体标题：演示视频");
    expect(text).not.toContain("secret.png");
    expect(text).not.toContain("不应进入索引");
    expect(text).not.toContain("example.com/video");
  });

  it("splits on bold paragraph section labels (work log style)", () => {
    const section = (label: string, tail = "：") => ({
      type: "paragraph",
      attrs: { textAlign: null },
      content: [
        { type: "text", marks: [{ type: "bold" }], text: label },
        { type: "text", text: tail }
      ]
    });
    const listItem = (text: string) => ({
      type: "listItem",
      content: [{ type: "paragraph", content: [{ type: "text", text }] }]
    });

    const blocks = splitTiptapToBlocks({
      type: "doc",
      content: [
        section("项目名称", "：SD 微调"),
        section("今日工作内容"),
        { type: "bulletList", content: [listItem("收集图像 1,200 张。"), listItem("预处理与裁剪。")] },
        section("实验结果/进度"),
        { type: "bulletList", content: [listItem("loss 下降至 0.21。")] },
        section("明日计划"),
        { type: "bulletList", content: [listItem("完成训练后评测。")] }
      ]
    });

    expect(blocks.length).toBeGreaterThanOrEqual(4);
    expect(blocks[0]).toContain("项目名称");
    expect(blocks[1]).toContain("今日工作内容");
    expect(blocks[1]).toContain("收集图像");
    expect(blocks.some((b) => b.includes("实验结果"))).toBe(true);
    expect(paragraphBoldSectionLabel(section("今日工作内容") as never)).toBe("今日工作内容");
    expect(paragraphBoldSectionLabel({ type: "paragraph", content: [{ type: "text", text: "普通段落" }] } as never)).toBeNull();
  });

  it("slices oversized sections", () => {
    const blocks = splitTiptapToBlocks({
      type: "doc",
      content: [{ type: "paragraph", content: [{ type: "text", text: "x".repeat(5000) }] }]
    });

    expect(blocks.length).toBeGreaterThan(1);
    expect(blocks.every((block) => block.length <= 3600)).toBe(true);
  });
});

describe("splitTiptapIntoChunks", () => {
  it("assigns stable sequential ids and hashes", () => {
    const chunks = splitTiptapIntoChunks(
      node({
        type: "doc",
        content: [
          { type: "heading", attrs: { level: 1 }, content: [{ type: "text", text: "A" }] },
          { type: "paragraph", content: [{ type: "text", text: "one" }] },
          { type: "heading", attrs: { level: 1 }, content: [{ type: "text", text: "B" }] },
          { type: "paragraph", content: [{ type: "text", text: "two" }] }
        ]
      }),
      "Root",
      "t"
    );

    expect(chunks.map((chunk) => chunk.id)).toEqual(["log1:0", "log1:1"]);
    expect(chunks.every((chunk) => chunk.contentHash)).toBe(true);
  });
});
