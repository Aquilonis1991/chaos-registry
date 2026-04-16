import { mkdir, readFile, writeFile } from "fs/promises";
import { join } from "path";
import { getAgentDataRoot } from "./paths";

export type AgentConfig = {
  agentId: string;
  email: string;
  password: string;
  behaviorPrompt: string;
};

const CONFIG_FILE = "agent_configs.json";

function getConfigPath(): string {
  return join(getAgentDataRoot(), CONFIG_FILE);
}

export async function readAgentConfigs(): Promise<Record<string, AgentConfig>> {
  try {
    const raw = await readFile(getConfigPath(), "utf8");
    const parsed = JSON.parse(raw) as Record<string, AgentConfig>;
    return parsed ?? {};
  } catch {
    return {};
  }
}

export async function writeAgentConfigs(configs: Record<string, AgentConfig>): Promise<void> {
  const root = getAgentDataRoot();
  await mkdir(root, { recursive: true });
  await writeFile(getConfigPath(), JSON.stringify(configs, null, 2), "utf8");
}

