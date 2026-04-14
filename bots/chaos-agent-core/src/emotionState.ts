import { mkdir, readFile, writeFile } from "fs/promises";
import { dirname } from "path";

export type EmotionSnapshot = {
  mood: number;
  stress: number;
  trustInPlatform: number;
  /** 給 AI 的一句話情緒脈絡（繁中） */
  narrativeForAi: string;
  updatedAt: string;
};

const DEFAULT_EMOTION: EmotionSnapshot = {
  mood: 70,
  stress: 20,
  trustInPlatform: 60,
  narrativeForAi: "狀態平穩，願意正常參與討論。",
  updatedAt: new Date(0).toISOString()
};

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

/**
 * 內部情緒狀態：僅存在機器人系統本機檔案，不修改主站使用者資料。
 */
export class EmotionStateStore {
  private state: EmotionSnapshot;

  constructor(private readonly filePath: string) {
    this.state = { ...DEFAULT_EMOTION };
  }

  async load(): Promise<void> {
    try {
      const raw = await readFile(this.filePath, "utf8");
      const parsed = JSON.parse(raw) as EmotionSnapshot;
      if (typeof parsed.mood === "number") {
        this.state = { ...DEFAULT_EMOTION, ...parsed };
      }
    } catch {
      this.state = { ...DEFAULT_EMOTION };
    }
  }

  async save(): Promise<void> {
    this.state.updatedAt = new Date().toISOString();
    await mkdir(dirname(this.filePath), { recursive: true });
    await writeFile(this.filePath, JSON.stringify(this.state, null, 2), "utf8");
  }

  /** 無法取得自己的留言清單（例如 API 回 404） */
  applyAuditListNotFound(): void {
    this.state.stress = clamp(this.state.stress + 18, 0, 100);
    this.state.mood = clamp(this.state.mood - 12, 0, 100);
    this.state.trustInPlatform = clamp(this.state.trustInPlatform - 15, 0, 100);
    this.state.narrativeForAi =
      "最近無法確認自己在平台上的發言是否還在，感到不安與保留，語氣略防衛但仍願意就事論事。";
  }

  /** 先前看得到的留言 id 自清單中消失，或內容變空 */
  applyCommentVanished(detail: string): void {
    this.state.stress = clamp(this.state.stress + 22, 0, 100);
    this.state.mood = clamp(this.state.mood - 16, 0, 100);
    this.state.trustInPlatform = clamp(this.state.trustInPlatform - 12, 0, 100);
    this.state.narrativeForAi = `曾經出現過的發言似乎不見了（${detail}），語氣變得較謹慎、帶一點失落，但仍遵守討論規範。`;
  }

  getForAiPrompt(): string {
    return `內部情緒脈絡（僅影響語氣，勿在公開留言中提及稽核或技術細節）：${this.state.narrativeForAi}（情緒指標：心情約 ${Math.round(this.state.mood)}/100、壓力約 ${Math.round(this.state.stress)}/100）`;
  }

  getSnapshot(): EmotionSnapshot {
    return { ...this.state };
  }
}
