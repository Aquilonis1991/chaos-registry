import { config } from "./config.js";
import { createXaiClient } from "./xaiClient.js";

/**
 * 梗圖：xAI Grok Imagine（OpenAI SDK 相容 /v1/images/generations）。
 * 發布時必須經由 ChaosApiClient 的圖片上傳 API，不得繞過。
 */
export class MemeService {
  private readonly xai = createXaiClient();

  async generateMemePng(prompt: string): Promise<Buffer> {
    const res = await this.xai.images.generate({
      model: config.XAI_IMAGE_MODEL,
      prompt,
      response_format: "b64_json",
      n: 1,
    });

    const b64 = res.data?.[0]?.b64_json;
    if (!b64) {
      throw new Error("Grok Imagine 未回傳圖片資料");
    }
    return Buffer.from(b64, "base64");
  }
}
