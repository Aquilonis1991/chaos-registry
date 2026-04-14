import { unlink, writeFile } from "fs/promises";
import { join } from "path";
import { getAgentDataRoot } from "@/lib/paths";

function requireAdmin(req: Request): boolean {
  const expected = process.env.ADMIN_SECRET;
  if (!expected) return true;
  return req.headers.get("x-admin-secret") === expected;
}

/**
 * GET：回傳執行開關狀態
 * POST:
 * - { emergency: true|false }  => 緊急剎車
 * - { enabled: true|false }    => 允許/停用執行（RUN_ENABLED）
 */
export async function GET(req: Request) {
  if (!requireAdmin(req)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const root = getAgentDataRoot();
  const fs = await import("fs/promises");
  const emergencyFlag = join(root, "EMERGENCY_STOP");
  const runEnabledFlag = join(root, "RUN_ENABLED");
  let emergency = false;
  let enabled = false;
  try {
    await fs.access(emergencyFlag);
    emergency = true;
  } catch {}
  try {
    await fs.access(runEnabledFlag);
    enabled = true;
  } catch {}
  return Response.json({ emergency, enabled, emergencyFlag, runEnabledFlag });
}

export async function POST(req: Request) {
  if (!requireAdmin(req)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const body = (await req.json().catch(() => ({}))) as { emergency?: boolean; enabled?: boolean };
  const root = getAgentDataRoot();
  const emergencyFlag = join(root, "EMERGENCY_STOP");
  const runEnabledFlag = join(root, "RUN_ENABLED");

  if (typeof body.emergency === "boolean") {
    if (body.emergency) {
      await writeFile(emergencyFlag, `stopped_at=${new Date().toISOString()}\n`, "utf8");
      return Response.json({ ok: true, emergency: true });
    }
    try {
      await unlink(emergencyFlag);
    } catch {
      // ignore
    }
    return Response.json({ ok: true, emergency: false });
  }

  if (typeof body.enabled === "boolean") {
    if (body.enabled) {
      await writeFile(runEnabledFlag, `enabled_at=${new Date().toISOString()}\n`, "utf8");
      // 啟用時自動移除 emergency flag，避免雙重狀態互相衝突
      try {
        await unlink(emergencyFlag);
      } catch {}
      return Response.json({ ok: true, enabled: true });
    }
    try {
      await unlink(runEnabledFlag);
    } catch {}
    return Response.json({ ok: true, enabled: false });
  }

  return Response.json({ error: "Invalid payload" }, { status: 400 });
}
