import { describe, expect, it } from "vitest";
import { normalizeLoadedIndexStatus, redactForDiagnostics } from "./errorReporting";

describe("redactForDiagnostics", () => {
  it("masks apiKey JSON field", () => {
    const s = redactForDiagnostics('{"apiKey":"sk-secret1234567890"}');
    expect(s).toContain("***");
    expect(s).not.toContain("secret1234567890");
  });

  it("masks Authorization bearer token", () => {
    const s = redactForDiagnostics("Authorization: Bearer abcdef123456");
    expect(s).toMatch(/Bearer\s+\*\*\*/);
  });
});

describe("normalizeLoadedIndexStatus", () => {
  it("parses valid rows and skips invalid", () => {
    const rows = [
      { logId: "1", indexedAt: "2026-01-01T00:00:00.000Z", chunkCount: 3, status: "indexed" },
      { logId: "", chunkCount: 1, status: "pending" },
      { bad: true }
    ];
    const out = normalizeLoadedIndexStatus(rows);
    expect(out).toHaveLength(1);
    expect(out[0].logId).toBe("1");
    expect(out[0].chunkCount).toBe(3);
    expect(out[0].status).toBe("indexed");
  });

  it("coerces unknown status to pending", () => {
    const out = normalizeLoadedIndexStatus([{ logId: "x", indexedAt: "t", chunkCount: 0, status: "weird" }]);
    expect(out[0].status).toBe("pending");
  });
});
