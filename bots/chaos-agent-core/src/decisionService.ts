import type { MemoryService } from "./memoryService.js";

/**
 * 僅在機器人系統內記錄「為何要做某個對外行為」的決策邏輯，不寫入 ChaosRegistry。
 */
export async function recordDataProtectionIntent(
  memory: MemoryService,
  agentId: string,
  internalReason: string
): Promise<void> {
  await memory.addConversationMemory({
    id: `${agentId}-dp-intent-${Date.now()}`,
    agentId,
    counterpartId: "system",
    content: `[數據保護決策] 內部理由：${internalReason}`,
    createdAt: new Date().toISOString(),
    tags: ["decision", "data-protection", "intent"]
  });
}

export async function recordDataProtectionFailure(
  memory: MemoryService,
  agentId: string,
  reason: string
): Promise<void> {
  await memory.addConversationMemory({
    id: `${agentId}-dp-fail-${Date.now()}`,
    agentId,
    counterpartId: "system",
    content: `[數據保護失敗] 規則閉環：未呼叫 API。原因：${reason}`,
    createdAt: new Date().toISOString(),
    tags: ["decision", "data-protection", "blocked"]
  });
}

export async function recordMemePublishIntent(
  memory: MemoryService,
  agentId: string,
  promptSummary: string
): Promise<void> {
  await memory.addConversationMemory({
    id: `${agentId}-meme-intent-${Date.now()}`,
    agentId,
    counterpartId: "system",
    content: `[梗圖決策] 將透過公共上傳 API 發布。提示摘要：${promptSummary}`,
    createdAt: new Date().toISOString(),
    tags: ["decision", "meme", "intent"]
  });
}

export async function recordMemeBlocked(
  memory: MemoryService,
  agentId: string,
  reason: string
): Promise<void> {
  await memory.addConversationMemory({
    id: `${agentId}-meme-blocked-${Date.now()}`,
    agentId,
    counterpartId: "system",
    content: `[梗圖失敗] 規則閉環：未產生或未上傳。原因：${reason}`,
    createdAt: new Date().toISOString(),
    tags: ["decision", "meme", "blocked"]
  });
}
