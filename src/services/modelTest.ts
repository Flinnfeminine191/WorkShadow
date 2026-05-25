import type { ModelConfig } from "../types";

async function callChatCompletions(config: ModelConfig, messages: { role: "system" | "user"; content: string }[], errorLabel: string) {
  if (!config.baseUrl.trim() || !config.apiKey.trim() || !config.model.trim()) {
    throw new Error("Fill in Base URL, API Key, and model name first.");
  }

  const response = await fetch(`${config.baseUrl.trim().replace(/\/$/, "")}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.apiKey.trim()}`
    },
    body: JSON.stringify({
      model: config.model.trim(),
      messages,
      temperature: 0,
      max_tokens: 32
    })
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`${errorLabel} request failed: ${response.status} ${response.statusText}${body ? ` — ${body.slice(0, 200)}` : ""}`);
  }
  const data = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> };
  const text = data.choices?.[0]?.message?.content?.trim();
  if (!text) throw new Error(`${errorLabel} returned an empty response.`);
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
  if (!config.baseUrl.trim() || !config.apiKey.trim() || !config.model.trim()) {
    throw new Error("Fill in Base URL, API Key, and model name first.");
  }

  const response = await fetch(`${config.baseUrl.trim().replace(/\/$/, "")}/embeddings`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.apiKey.trim()}`
    },
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
