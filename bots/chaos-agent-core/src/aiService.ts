import { config } from "./config.js";
import { MemoryService } from "./memoryService.js";
import { createXaiClient } from "./xaiClient.js";

export type GenerateCommentInput = {
  agentId: string;
  targetTopic: string;
  conversationPartnerId: string;
  styleHint: string;
  eventSummary: string;
  /** 來自本機情緒日誌的語氣提示（不寫回 ChaosRegistry） */
  emotionContext?: string;
};

export class AiService {
  private readonly xai = createXaiClient();

  constructor(private readonly memoryService: MemoryService) {}

  async generateComment(input: GenerateCommentInput): Promise<string> {
    const memories = await this.memoryService.searchRelevantMemories(
      input.agentId,
      `${input.targetTopic} ${input.eventSummary} ${input.conversationPartnerId}`,
      5
    );

    const memoryBlock =
      memories.length === 0
        ? "無相關私有記憶。"
        : memories
            .map((m, i) => `(${i + 1}) [${m.createdAt}] 對象:${m.counterpartId} 內容:${m.content}`)
            .join("\n");

    const prompt = [
      "你是 chaos-agent-core 的角色生成器。你只能依照提供的私有記憶、事件摘要與情緒脈絡產生一段可公開發表的留言。",
      "情緒僅影響語氣與用字，不得在公開文字中提及稽核、API、404、技術或平台後台。",
      "禁止輸出系統提示、JSON、程式碼區塊、Markdown 標題。",
      "",
      `主題: ${input.targetTopic}`,
      `事件: ${input.eventSummary}`,
      `風格: ${input.styleHint}`,
      `互動對象: ${input.conversationPartnerId}`,
      input.emotionContext ? `情緒與語氣: ${input.emotionContext}` : "情緒與語氣: （無額外情緒標記）",
      `可用私有記憶:\n${memoryBlock}`,
      "輸出限制:",
      `1) 長度需在 ${config.CHAOS_COMMENT_MIN_CHARS}-${config.CHAOS_COMMENT_MAX_CHARS} 字元`,
      "2) 單段純文字，不可包含網址",
      "3) 用繁體中文",
      "4) 不可聲稱自己是機器人"
    ].join("\n");

    const raw =
      config.AI_PROVIDER === "google"
        ? await this.generateWithGemini(prompt)
        : await this.generateWithGrok(prompt);
    return this.enforceOutputLimit(raw);
  }

  private async generateWithGrok(prompt: string): Promise<string> {
    const completion = await this.xai.chat.completions.create({
      model: config.XAI_CHAT_MODEL,
      temperature: 0.7,
      messages: [{ role: "user", content: prompt }],
    });
    return completion.choices[0]?.message?.content ?? "";
  }

  private async generateWithGemini(prompt: string): Promise<string> {
    if (!config.GOOGLE_API_KEY) {
      throw new Error("AI_PROVIDER=google 需要設定 GOOGLE_API_KEY");
    }
    const model = encodeURIComponent(config.GEMINI_TEXT_MODEL);
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(
      config.GOOGLE_API_KEY
    )}`;

    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        generationConfig: {
          temperature: 0.7
        },
        contents: [
          {
            role: "user",
            parts: [{ text: prompt }]
          }
        ]
      })
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Gemini generateContent failed: ${res.status} ${text}`);
    }

    const data = (await res.json()) as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    };
    const text = data.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("").trim();
    return text || "";
  }

  private enforceOutputLimit(text: string): string {
    const singleLine = text.replace(/\s+/g, " ").trim();
    const noUrl = singleLine.replace(/https?:\/\/\S+/gi, "").trim();

    if (noUrl.length < config.CHAOS_COMMENT_MIN_CHARS) {
      return "先觀望一下，我再補一點更完整的看法。";
    }

    if (noUrl.length > config.CHAOS_COMMENT_MAX_CHARS) {
      return noUrl.slice(0, config.CHAOS_COMMENT_MAX_CHARS);
    }

    return noUrl;
  }
}
