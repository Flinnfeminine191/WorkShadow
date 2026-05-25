import { describe, expect, it } from "vitest";
import type { LogNode } from "../types";
import {
  LlmInputTooLongError,
  LOG_SUMMARY_MAX_DIGEST_CHARS,
  LOG_SUMMARY_MAX_PER_LOG_CHARS,
  assertLogSummaryInputWithinLimit,
  estimateLogsDigestChars
} from "./llmInputLimits";

function log(id: string, body: string): LogNode {
  return {
    id,
    parentId: null,
    title: id,
    kind: "log",
    createdAt: "",
    updatedAt: "",
    tiptapJson: {},
    markdown: body
  };
}

describe("estimateLogsDigestChars", () => {
  it("sums per-log blocks", () => {
    const chars = estimateLogsDigestChars([log("a", "hello"), log("b", "world")], 5000);
    expect(chars).toBeGreaterThan(10);
  });
});

describe("assertLogSummaryInputWithinLimit", () => {
  it("throws when digest exceeds cap", () => {
    const big = "x".repeat(LOG_SUMMARY_MAX_PER_LOG_CHARS);
    const logs = Array.from({ length: 10 }, (_, i) => log(`log-${i}`, big));
    const digestChars = estimateLogsDigestChars(logs, LOG_SUMMARY_MAX_PER_LOG_CHARS);
    expect(digestChars).toBeGreaterThan(LOG_SUMMARY_MAX_DIGEST_CHARS);
    expect(() => assertLogSummaryInputWithinLimit(logs, [], true)).toThrow(LlmInputTooLongError);
  });

  it("passes for small selection", () => {
    expect(() => assertLogSummaryInputWithinLimit([log("a", "short note")], [], true)).not.toThrow();
  });
});
