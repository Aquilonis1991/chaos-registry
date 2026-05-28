/** xAI Grok — OpenAI 相容 Chat Completions（https://api.x.ai/v1） */

export const XAI_API_BASE = "https://api.x.ai/v1";

export const XAI_DEFAULT_FAST_MODEL = "grok-4-1-fast-non-reasoning";
export const XAI_DEFAULT_CHAT_MODEL = "grok-4.3";

export function getXaiApiKey(): string {
  const key = Deno.env.get("XAI_API_KEY") ?? Deno.env.get("OPENAI_API_KEY");
  if (!key) {
    throw new Error("XAI API Key not configured (set XAI_API_KEY in Edge Function secrets)");
  }
  return key;
}

export type XaiChatMessage = { role: "system" | "user" | "assistant"; content: string };

export type XaiChatCompletionOptions = {
  model?: string;
  messages: XaiChatMessage[];
  temperature?: number;
  response_format?: { type: "json_object" };
};

export type XaiChatCompletionResult = {
  choices?: Array<{ message?: { content?: string } }>;
  error?: { message?: string };
};

export async function xaiChatCompletion(
  options: XaiChatCompletionOptions
): Promise<XaiChatCompletionResult> {
  const apiKey = getXaiApiKey();
  const model = options.model ?? XAI_DEFAULT_FAST_MODEL;

  const res = await fetch(`${XAI_API_BASE}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages: options.messages,
      temperature: options.temperature ?? 0.7,
      ...(options.response_format ? { response_format: options.response_format } : {}),
    }),
  });

  const data = (await res.json()) as XaiChatCompletionResult;
  if (!res.ok && !data.error) {
    throw new Error(`xAI request failed: HTTP ${res.status}`);
  }
  return data;
}
