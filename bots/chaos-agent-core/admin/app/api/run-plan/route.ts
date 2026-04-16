import { access } from "fs/promises";
import { spawn } from "child_process";
import { join } from "path";

function requireAdmin(req: Request): boolean {
  const expected = process.env.ADMIN_SECRET;
  if (!expected) return true;
  return req.headers.get("x-admin-secret") === expected;
}

function runCommand(command: string, cwd: string, env: NodeJS.ProcessEnv): Promise<{ code: number; output: string }> {
  return new Promise((resolve) => {
    const child = spawn(command, { cwd, env, shell: true });
    let output = "";
    child.stdout.on("data", (d) => (output += String(d)));
    child.stderr.on("data", (d) => (output += String(d)));
    child.on("close", (code) => resolve({ code: code ?? 1, output }));
  });
}

export async function POST(req: Request) {
  if (!requireAdmin(req)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  let agentId = "agent-01";
  let email: string | undefined;
  let password: string | undefined;
  let behaviorPrompt: string | undefined;
  try {
    const payload = (await req.json()) as {
      agentId?: unknown;
      email?: unknown;
      password?: unknown;
      behaviorPrompt?: unknown;
    };
    if (typeof payload.agentId === "string" && payload.agentId.trim()) {
      agentId = payload.agentId.trim();
    }
    if (typeof payload.email === "string" && payload.email.trim()) {
      email = payload.email.trim();
    }
    if (typeof payload.password === "string" && payload.password.trim()) {
      password = payload.password;
    }
    if (typeof payload.behaviorPrompt === "string" && payload.behaviorPrompt.trim()) {
      behaviorPrompt = payload.behaviorPrompt.trim();
    }
  } catch {
    // no body is acceptable; fallback to default agent id
  }

  const root = join(process.cwd(), "..");
  const dataRoot = process.env.AGENT_DATA_DIR || join(root, "data");
  const runEnabledFlag = join(dataRoot, "RUN_ENABLED");
  const emergencyFlag = join(dataRoot, "EMERGENCY_STOP");

  try {
    await access(runEnabledFlag);
  } catch {
    return Response.json({ error: "RUN_ENABLED not set. 請先在後台按「啟用執行」" }, { status: 409 });
  }

  try {
    await access(emergencyFlag);
    return Response.json({ error: "EMERGENCY_STOP active. 請先解除剎車" }, { status: 409 });
  } catch {
    // expected path when emergency not active
  }

  const env = {
    ...process.env,
    AGENT_TRIGGER_SOURCE: "admin-api",
    AGENT_ID: agentId,
    ...(email ? { CHAOS_API_EMAIL: email } : {}),
    ...(password ? { CHAOS_API_PASSWORD: password } : {}),
    ...(behaviorPrompt
      ? { AGENT_STYLE_HINT: behaviorPrompt, AGENT_EVENT_SUMMARY: behaviorPrompt.slice(0, 60) }
      : {})
  };

  const result = await runCommand("npm run agent:plan", root, env);
  if (result.code !== 0) {
    return Response.json({ ok: false, output: result.output }, { status: 500 });
  }
  return Response.json({ ok: true, output: result.output });
}

