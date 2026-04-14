import { existsSync } from "fs";
import { join } from "path";
import { config } from "./config.js";

/**
 * 緊急剎車：設為 true 時不對主站發起任何寫入動作。
 * - 環境變數 AGENT_EMERGENCY_STOP=1 / true
 * - 或在本機 AGENT_DATA_DIR 目錄建立檔名 EMERGENCY_STOP（空檔即可）
 */
export function isEmergencyStopActive(): boolean {
  const env = String(process.env.AGENT_EMERGENCY_STOP || "").toLowerCase();
  if (env === "1" || env === "true" || env === "yes") {
    return true;
  }
  const emergencyFlag = join(config.AGENT_DATA_DIR, "EMERGENCY_STOP");
  const runEnabledFlag = join(config.AGENT_DATA_DIR, "RUN_ENABLED");

  // 最高優先：緊急剎車旗標
  if (existsSync(emergencyFlag)) return true;
  // 次優先：明確允許執行旗標（僅後台可切換）
  if (existsSync(runEnabledFlag)) return false;
  // 安全預設：若未啟用 RUN_ENABLED，一律視為停止狀態
  return true;
}
