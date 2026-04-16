import { readAgentConfigs, writeAgentConfigs } from "@/lib/agentConfigs";

function requireAdmin(req: Request): boolean {
  const expected = process.env.ADMIN_SECRET;
  if (!expected) return true;
  return req.headers.get("x-admin-secret") === expected;
}

export async function GET(req: Request) {
  if (!requireAdmin(req)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const configs = await readAgentConfigs();
  return Response.json({ configs });
}

export async function POST(req: Request) {
  if (!requireAdmin(req)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const payload = (await req.json()) as {
    agentId?: unknown;
    email?: unknown;
    password?: unknown;
    behaviorPrompt?: unknown;
  };

  const agentId = typeof payload.agentId === "string" ? payload.agentId.trim() : "";
  if (!agentId) {
    return Response.json({ error: "agentId is required" }, { status: 400 });
  }

  const email = typeof payload.email === "string" ? payload.email.trim() : "";
  const password = typeof payload.password === "string" ? payload.password : "";
  const behaviorPrompt =
    typeof payload.behaviorPrompt === "string" ? payload.behaviorPrompt.trim() : "";

  const configs = await readAgentConfigs();
  configs[agentId] = { agentId, email, password, behaviorPrompt };
  await writeAgentConfigs(configs);

  return Response.json({ ok: true, config: configs[agentId] });
}

