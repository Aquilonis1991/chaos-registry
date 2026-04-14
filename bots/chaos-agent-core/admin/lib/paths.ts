import { join } from "path";

/** 與 chaos-agent-core 的 AGENT_DATA_DIR 對齊；預設為上層目錄的 data */
export function getAgentDataRoot(): string {
  return process.env.AGENT_DATA_DIR || join(process.cwd(), "..", "data");
}
