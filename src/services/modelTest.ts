import type { ModelConfig } from "../types";
import {
  buildOpenAiHeaders,
  extractChatChoiceText,
  isModelConfigReady,
  openAiChatCompletionsUrl,
  openAiEmbeddingsUrl
} from "./openaiCompat";

async function callChatCompletions(
  config: ModelConfig,
  messages: { role: "system" | "user"; content: string }[],
  errorLabel: string
) {
  if (!isModelConfigReady(config)) {
    throw new Error("Fill in Base URL, API Key (if required), and model name first.");
  }

  const response = await fetch(openAiChatCompletionsUrl(config.baseUrl), {
    method: "POST",
    headers: buildOpenAiHeaders(config.apiKey),
    body: JSON.stringify({
      model: config.model.trim(),
      messages,
      temperature: 0,
      max_tokens: 128,
      stream: false
    })
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`${errorLabel} request failed: ${response.status} ${response.statusText}${body ? ` — ${body.slice(0, 200)}` : ""}`);
  }
  const data = (await response.json()) as { choices?: unknown[] };
  const text = extractChatChoiceText(data.choices?.[0]);
  if (!text) {
    const preview = JSON.stringify(data).slice(0, 300);
    throw new Error(`${errorLabel} returned an empty response.${preview ? ` Response: ${preview}` : ""}`);
  }
  return text;
}

export async function testLlmConfig(config: ModelConfig): Promise<string> {
  return callChatCompletions(
    config,
    [
      { role: "system", content: "Reply with exactly: OK" },
      { role: "user", content: "WorkShadow connectivity test." }
    ],
    "LLM"
  );
}

export async function testEmbeddingConfig(config: ModelConfig): Promise<string> {
  if (!isModelConfigReady(config)) {
    throw new Error("Fill in Base URL, API Key (if required), and model name first.");
  }

  const response = await fetch(openAiEmbeddingsUrl(config.baseUrl), {
    method: "POST",
    headers: buildOpenAiHeaders(config.apiKey),
    body: JSON.stringify({
      model: config.model.trim(),
      input: ["WorkShadow connectivity test"]
    })
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(
      `Embedding request failed: ${response.status} ${response.statusText}${body ? ` — ${body.slice(0, 200)}` : ""}`
    );
  }

  const data = (await response.json()) as { data?: Array<{ embedding?: number[] }> };
  const dim = data.data?.[0]?.embedding?.length;
  if (!dim) throw new Error("Embedding returned no vector.");
  return String(dim);
}
