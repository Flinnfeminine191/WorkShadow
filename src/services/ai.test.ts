import { describe, expect, it, vi } from "vitest";
import { consumeSseChatBuffer, extractContentDeltaFromSseLine } from "./ai";

describe("extractContentDeltaFromSseLine", () => {
  it("parses content delta", () => {
    const line = 'data: {"choices":[{"delta":{"content":"你好"}}]}';
    expect(extractContentDeltaFromSseLine(line)).toBe("你好");
  });

  it("returns null for DONE and non-data lines", () => {
    expect(extractContentDeltaFromSseLine("data: [DONE]")).toBeNull();
    expect(extractContentDeltaFromSseLine(": ping")).toBeNull();
    expect(extractContentDeltaFromSseLine("")).toBeNull();
  });

  it("ignores empty content", () => {
    const line = 'data: {"choices":[{"delta":{"content":""}}]}';
    expect(extractContentDeltaFromSseLine(line)).toBeNull();
  });
});

describe("consumeSseChatBuffer", () => {
  it("accumulates multiple lines", () => {
    const onDelta = vi.fn();
    const full = consumeSseChatBuffer(
      'data: {"choices":[{"delta":{"content":"A"}}]}\ndata: {"choices":[{"delta":{"content":"B"}}]}\n',
      onDelta
    );
    expect(full).toBe("AB");
    expect(onDelta).toHaveBeenCalledTimes(2);
  });
});
