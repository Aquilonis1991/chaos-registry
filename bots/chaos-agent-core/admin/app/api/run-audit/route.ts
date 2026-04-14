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
    AGENT_TRIGGER_SOURCE: "admin-api"
  };

  const result = await runCommand("npm run agent:audit", root, env);
  if (result.code !== 0) {
    return Response.json({ ok: false, output: result.output }, { status: 500 });
  }
  return Response.json({ ok: true, output: result.output });
}

