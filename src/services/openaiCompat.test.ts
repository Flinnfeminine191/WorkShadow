import { describe, expect, it } from "vitest";
import {
  extractChatChoiceText,
  extractChatMessageContent,
  isModelConfigReady,
  openAiChatCompletionsUrl
} from "./openaiCompat";

describe("openAiChatCompletionsUrl", () => {
  it("appends chat/completions to base", () => {
    expect(openAiChatCompletionsUrl("https://api.deepseek.com")).toBe(
      "https://api.deepseek.com/chat/completions"
    );
    expect(openAiChatCompletionsUrl("https://api.openai.com/v1/")).toBe(
      "https://api.openai.com/v1/chat/completions"
    );
  });

  it("keeps full endpoint unchanged", () => {
    expect(openAiChatCompletionsUrl("https://x/v1/chat/completions")).toBe("https://x/v1/chat/completions");
  });
});

describe("extractChatMessageContent", () => {
  it("reads string content", () => {
    expect(extractChatMessageContent({ content: "OK" })).toBe("OK");
  });

  it("reads array content parts", () => {
    expect(
      extractChatMessageContent({
        content: [{ type: "text", text: "hello" }]
      })
    ).toBe("hello");
  });

  it("falls back to reasoning_content", () => {
    expect(
      extractChatMessageContent({
        content: "",
        reasoning_content: "thought"
      })
    ).toBe("thought");
  });
});

describe("extractChatChoiceText", () => {
  it("reads legacy text field", () => {
    expect(extractChatChoiceText({ text: "legacy" })).toBe("legacy");
  });
});

describe("isModelConfigReady", () => {
  it("allows empty api key for ollama base url", () => {
    expect(
      isModelConfigReady({
        provider: "ollama",
        baseUrl: "http://127.0.0.1:11434/v1",
        apiKey: "",
        model: "llama3.2"
      })
    ).toBe(true);
  });

  it("requires api key for remote providers", () => {
    expect(
      isModelConfigReady({
        provider: "deepseek",
        baseUrl: "https://api.deepseek.com/v1",
        apiKey: "",
        model: "deepseek-chat"
      })
    ).toBe(false);
  });
});
