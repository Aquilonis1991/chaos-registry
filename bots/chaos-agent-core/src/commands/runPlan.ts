import { runAgentScenario } from "../agentRunner.js";

function requireAdminTrigger(): void {
  if (process.env.AGENT_TRIGGER_SOURCE !== "admin-api") {
    throw new Error("Blocked: only admin API can trigger plan execution");
  }
}

function asBool(value: string | undefined, fallback = false): boolean {
  if (value == null) return fallback;
  const v = value.toLowerCase();
  return v === "1" || v === "true" || v === "yes";
}

export async function runPlanOnceFromEnv(): Promise<void> {
  requireAdminTrigger();

  const topicId = process.env.AGENT_TOPIC_ID;
  const voteOptionId = process.env.AGENT_VOTE_OPTION_ID;

  if (!topicId || !voteOptionId) {
    throw new Error("Missing AGENT_TOPIC_ID or AGENT_VOTE_OPTION_ID in environment");
  }

  await runAgentScenario({
    agentId: process.env.AGENT_ID ?? "agent-01",
    conversationPartnerId: process.env.AGENT_PARTNER_ID ?? "user-unknown",
    topicId,
    targetTopic: process.env.AGENT_TARGET_TOPIC ?? "未命名主題",
    voteTargetId: process.env.AGENT_VOTE_TARGET_ID ?? topicId,
    voteOptionId,
    voteAmount: Number(process.env.AGENT_VOTE_AMOUNT ?? 1),
    arenaLanguage: (process.env.AGENT_ARENA_LANG as "zh" | "en" | "ja" | undefined) ?? "zh",
    eventSummary: process.env.AGENT_EVENT_SUMMARY ?? "無事件摘要",
    styleHint: process.env.AGENT_STYLE_HINT ?? "理性、簡潔",
    dataProtectionApiReason: process.env.AGENT_DP_API_REASON ?? "降低干擾",
    dataProtectionInternalDecision: process.env.AGENT_DP_INTERNAL_REASON ?? "保護資料邊界",
    requestDataProtection: asBool(process.env.AGENT_REQUEST_DATA_PROTECTION, false),
    initialTokenBalance: Number(process.env.AGENT_INITIAL_TOKENS ?? 0),
    votesReceivedForCurrentTopic: Number(process.env.AGENT_TOPIC_VOTES_RECEIVED ?? 0)
  });
}

if (import.meta.url === new URL(process.argv[1], "file:").href) {
  runPlanOnceFromEnv().catch((error) => {
    console.error("[Agent] runPlan failed:", error);
    process.exit(1);
  });
}
