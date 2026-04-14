import { readdir, readFile } from "fs/promises";
import { join } from "path";
import { getAgentDataRoot } from "@/lib/paths";

function requireAdmin(req: Request): boolean {
  const expected = process.env.ADMIN_SECRET;
  if (!expected) return true;
  return req.headers.get("x-admin-secret") === expected;
}

export async function GET(req: Request) {
  if (!requireAdmin(req)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const root = getAgentDataRoot();
  let names: string[] = [];
  try {
    names = await readdir(root, { withFileTypes: true }).then((ents) =>
      ents.filter((e) => e.isDirectory()).map((e) => e.name)
    );
  } catch {
    names = [];
  }

  const agents = await Promise.all(
    names.map(async (id) => {
      const dir = join(root, id);
      let emotion: unknown = null;
      let logTail: string[] = [];
      try {
        const emRaw = await readFile(join(dir, "emotion.json"), "utf8");
        emotion = JSON.parse(emRaw);
      } catch {
        emotion = null;
      }
      try {
        const logRaw = await readFile(join(dir, "internal_logs.jsonl"), "utf8");
        const lines = logRaw.trim().split("\n").filter(Boolean);
        logTail = lines.slice(-25);
      } catch {
        logTail = [];
      }
      return { id, emotion, logTail };
    })
  );

  const control = await readControlFlags();
  return Response.json({ dataRoot: root, control, agents });
}

async function readControlFlags(): Promise<{ enabled: boolean; emergency: boolean; effectiveStopped: boolean }> {
  const { access } = await import("fs/promises");
  const emergencyPath = join(getAgentDataRoot(), "EMERGENCY_STOP");
  const enabledPath = join(getAgentDataRoot(), "RUN_ENABLED");
  let emergency = false;
  let enabled = false;

  try {
    await access(emergencyPath);
    emergency = true;
  } catch {}

  try {
    await access(enabledPath);
    enabled = true;
  } catch {}

  const envStop = (() => {
    const v = process.env.AGENT_EMERGENCY_STOP?.toLowerCase();
    return v === "1" || v === "true";
  })();

  const effectiveStopped = envStop || emergency || !enabled;
  return { enabled, emergency: emergency || envStop, effectiveStopped };
}
