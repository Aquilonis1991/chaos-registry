import { join } from "path";
import { config } from "../config.js";
import { EmotionStateStore } from "../emotionState.js";
import { InternalLogWriter } from "../internalLog.js";
import { SupabaseChaosPlatform } from "../platform/supabasePlatform.js";
import { SelfAuditService } from "../selfAuditService.js";

function requireAdminTrigger(): void {
  if (process.env.AGENT_TRIGGER_SOURCE !== "admin-api") {
    throw new Error("Blocked: only admin API can trigger audit execution");
  }
}

export async function runAuditOnceFromEnv(): Promise<void> {
  requireAdminTrigger();

  if (!config.SUPABASE_URL || !config.SUPABASE_ANON_KEY) {
    throw new Error("Audit command requires SUPABASE_URL and SUPABASE_ANON_KEY");
  }

  const agentId = process.env.AGENT_ID ?? "agent-01";
  const platform = new SupabaseChaosPlatform(config.SUPABASE_URL, config.SUPABASE_ANON_KEY);
  await platform.signInWithEmail(config.CHAOS_API_EMAIL, config.CHAOS_API_PASSWORD);

  const dataDir = join(config.AGENT_DATA_DIR, agentId);
  const logs = new InternalLogWriter(join(dataDir, "internal_logs.jsonl"));
  const emotion = new EmotionStateStore(join(dataDir, "emotion.json"));
  await emotion.load();

  const audit = new SelfAuditService(
    platform,
    agentId,
    join(dataDir, "comment_snapshot.json"),
    logs,
    emotion
  );

  await audit.runAuditCycle();
  await emotion.save();
}

if (import.meta.url === new URL(process.argv[1], "file:").href) {
  runAuditOnceFromEnv().catch((error) => {
    console.error("[Agent] runAudit failed:", error);
    process.exit(1);
  });
}
