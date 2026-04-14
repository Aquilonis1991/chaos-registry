import { mkdir, appendFile } from "fs/promises";
import { dirname } from "path";

export type InternalLogEntry = {
  ts: number;
  agentId: string;
  type: "audit_list_404" | "comment_vanished" | "comment_list_error" | "single_comment_404";
  detail: string;
  /** 可選：相關公共 API 路徑，僅供除錯 */
  apiPath?: string;
};

/**
 * 機器人系統內部稽核日誌（不寫入 ChaosRegistry）。
 * 預設為 JSON Lines，便於日後匯入或串流分析。
 */
export class InternalLogWriter {
  constructor(private readonly jsonlPath: string) {}

  async append(entry: InternalLogEntry): Promise<void> {
    const line = JSON.stringify(entry) + "\n";
    await mkdir(dirname(this.jsonlPath), { recursive: true });
    await appendFile(this.jsonlPath, line, { encoding: "utf8" });
  }
}
