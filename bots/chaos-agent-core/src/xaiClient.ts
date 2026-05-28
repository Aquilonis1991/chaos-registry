import OpenAI from "openai";
import { config } from "./config.js";

/** xAI Grok API（OpenAI SDK 相容模式） */
export function createXaiClient(): OpenAI {
  return new OpenAI({
    apiKey: config.XAI_API_KEY,
    baseURL: "https://api.x.ai/v1",
  });
}
