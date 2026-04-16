import { readAgentConfigs } from "@/lib/agentConfigs";

function requireAdmin(req: Request): boolean {
  const expected = process.env.ADMIN_SECRET;
  if (!expected) return true;
  return req.headers.get("x-admin-secret") === expected;
}

export async function POST(req: Request) {
  if (!requireAdmin(req)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const payload = (await req.json()) as { agentId?: unknown };
  const agentId = typeof payload.agentId === "string" ? payload.agentId.trim() : "";
  if (!agentId) {
    return Response.json({ error: "agentId is required" }, { status: 400 });
  }

  const configs = await readAgentConfigs();
  const cfg = configs[agentId];
  const behavior = cfg?.behaviorPrompt?.trim() || "（未設定行為 Prompt）";

  const plan = [
    `Agent: ${agentId}`,
    "1) 檢查全域控制旗標（RUN_ENABLED / EMERGENCY_STOP）",
    "2) 使用該 agent 指定帳號登入",
    "3) 根據行為 Prompt 生成本輪發言風格",
    "4) 執行主計畫（投票 -> 發言 -> 記錄 private memory）",
    "5) 視需求執行自我稽核並回寫內部情緒",
    "",
    "Behavior Prompt:",
    behavior
  ].join("\n");

  return Response.json({ ok: true, agentId, plan });
}

