import OpenAI from "openai";
import { config } from "./config.js";

/**
 * 梗圖功能維持 OpenAI（DALL·E 3）。
 * 即使 AI_PROVIDER=google，也不影響此功能，以符合「僅機器人控制流程改用 Google」需求。
 * 發布時必須經由 ChaosApiClient 的圖片上傳 API，不得繞過。
 */
export class MemeService {
  private readonly openai = new OpenAI({ apiKey: config.OPENAI_API_KEY });

  async generateMemePng(prompt: string): Promise<Buffer> {
    const res = await this.openai.images.generate({
      model: "dall-e-3",
      prompt,
      size: config.DALLE_IMAGE_SIZE,
      response_format: "b64_json",
      n: 1
    });

    const b64 = res.data?.[0]?.b64_json;
    if (!b64) {
      throw new Error("DALL·E 3 未回傳圖片資料");
    }
    return Buffer.from(b64, "base64");
  }
}
