import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

const AGENT_IDS = Array.from({ length: 20 }, (_, idx) => `agent-${String(idx + 1).padStart(2, "0")}`);

type AgentConfig = {
  agentId: string;
  email: string;
  password: string;
  behaviorPrompt: string;
};

type ControlState = {
  enabled: boolean;
  emergency: boolean;
  effectiveStopped: boolean;
};

function resolveDefaultApiBase(): string {
  const envBase = import.meta.env.VITE_AGENT_ADMIN_BASE as string | undefined;
  if (envBase && envBase.trim().length > 0) return `${envBase.replace(/\/$/, "")}/api`;
  return "/agent-admin/api";
}

function emptyConfig(agentId: string): AgentConfig {
  return { agentId, email: "", password: "", behaviorPrompt: "" };
}

function looksLikeHtmlDocument(body: string): boolean {
  const s = body.trimStart().toLowerCase();
  return s.startsWith("<!doctype") || s.startsWith("<html") || s.includes("<head");
}

function nonJsonHint(fallbackError: string, raw: string): string {
  if (looksLikeHtmlDocument(raw)) {
    return (
      `${fallbackError}：收到主站網頁（HTML）而非 API JSON。` +
      `本機請確認已在 bots/chaos-agent-core/admin 執行 next dev（預設埠 3100），` +
      `且 votechaos-main 的 Vite 代理 /agent-admin 指向該埠（見 vite.config.ts，可用 .env 的 VITE_AGENT_ADMIN_PROXY_TARGET 覆寫）。` +
      `正式環境請在反向代理將 /agent-admin 轉發到 agent-admin 服務，或在建置時設定 VITE_AGENT_ADMIN_BASE 為該服務根網址（不含尾隨 /api）。`
    );
  }
  const sample = raw.slice(0, 300);
  return `${fallbackError}（非 JSON 回應）: ${sample || "<empty>"}`;
}

async function parseJsonSafe<T>(res: Response, fallbackError: string): Promise<T> {
  const raw = await res.text();
  try {
    return JSON.parse(raw) as T;
  } catch {
    throw new Error(nonJsonHint(fallbackError, raw));
  }
}

export function AiAgentControlBridge() {
  const [apiBaseInput, setApiBaseInput] = useState(() => {
    if (typeof window === "undefined") return resolveDefaultApiBase();
    return window.localStorage.getItem("agent_admin_api_base") || resolveDefaultApiBase();
  });
  const [apiBase, setApiBase] = useState(() => {
    if (typeof window === "undefined") return resolveDefaultApiBase();
    return window.localStorage.getItem("agent_admin_api_base") || resolveDefaultApiBase();
  });

  const [secret, setSecret] = useState("");
  const [control, setControl] = useState<ControlState | null>(null);
  const [configs, setConfigs] = useState<Record<string, AgentConfig>>({});
  const [plans, setPlans] = useState<Record<string, string>>({});
  const [outputs, setOutputs] = useState<Record<string, string>>({});
  const [running, setRunning] = useState<Record<string, { plan: boolean; audit: boolean }>>({});
  const [err, setErr] = useState<string | null>(null);

  const jsonHeaders = useMemo(() => {
    const h: Record<string, string> = { "Content-Type": "application/json" };
    if (secret.trim()) h["x-admin-secret"] = secret.trim();
    return h;
  }, [secret]);

  const authHeaders = useMemo(() => {
    const h: Record<string, string> = {};
    if (secret.trim()) h["x-admin-secret"] = secret.trim();
    return h;
  }, [secret]);

  const withBase = (path: string) => `${apiBase.trim().replace(/\/$/, "")}${path}`;

  const applyApiBase = () => {
    const next = apiBaseInput.trim() || resolveDefaultApiBase();
    setApiBase(next);
    if (typeof window !== "undefined") window.localStorage.setItem("agent_admin_api_base", next);
  };

  const load = async () => {
    setErr(null);
    try {
      const [cfgRes, agentsRes] = await Promise.all([
        fetch(withBase("/agent-configs"), { headers: authHeaders }),
        fetch(withBase("/agents"), { headers: authHeaders }),
      ]);

      if (!cfgRes.ok) throw new Error(await cfgRes.text());
      const cfgBody = await parseJsonSafe<{ configs?: Record<string, AgentConfig> }>(
        cfgRes,
        "讀取 agent-configs 失敗"
      );
      const merged: Record<string, AgentConfig> = {};
      for (const id of AGENT_IDS) merged[id] = cfgBody.configs?.[id] ?? emptyConfig(id);
      setConfigs(merged);

      if (agentsRes.ok) {
        const agentBody = await parseJsonSafe<{ control?: ControlState }>(
          agentsRes,
          "讀取 agents 失敗"
        );
        setControl(agentBody.control ?? null);
      }
    } catch (e) {
      setErr(String(e));
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiBase, secret]);

  const updateConfig = (agentId: string, patch: Partial<AgentConfig>) => {
    setConfigs((prev) => ({
      ...prev,
      [agentId]: { ...(prev[agentId] ?? emptyConfig(agentId)), ...patch, agentId },
    }));
  };

  const saveConfig = async (agentId: string) => {
    setErr(null);
    try {
      const payload = configs[agentId] ?? emptyConfig(agentId);
      const res = await fetch(withBase("/agent-configs"), {
        method: "POST",
        headers: jsonHeaders,
        body: JSON.stringify(payload),
      });
      const text = await res.text();
      if (!res.ok) throw new Error(text);
      setOutputs((prev) => ({ ...prev, [agentId]: `設定儲存成功\n${text}` }));
    } catch (e) {
      setErr(String(e));
    }
  };

  const generatePlan = async (agentId: string) => {
    setErr(null);
    try {
      const res = await fetch(withBase("/generate-plan"), {
        method: "POST",
        headers: jsonHeaders,
        body: JSON.stringify({ agentId }),
      });
      const body = await parseJsonSafe<{ plan?: string; error?: string }>(
        res,
        "生產計畫失敗"
      );
      if (!res.ok) throw new Error(body.error || "生產計畫失敗");
      setPlans((prev) => ({ ...prev, [agentId]: body.plan || "" }));
    } catch (e) {
      setErr(String(e));
    }
  };

  const trigger = async (agentId: string, kind: "plan" | "audit") => {
    setErr(null);
    setRunning((prev) => ({ ...prev, [agentId]: { plan: kind === "plan", audit: kind === "audit" } }));
    try {
      const cfg = configs[agentId] ?? emptyConfig(agentId);
      const res = await fetch(withBase(kind === "plan" ? "/run-plan" : "/run-audit"), {
        method: "POST",
        headers: jsonHeaders,
        body: JSON.stringify({
          agentId,
          email: cfg.email,
          password: cfg.password,
          behaviorPrompt: cfg.behaviorPrompt,
        }),
      });
      const text = await res.text();
      setOutputs((prev) => ({ ...prev, [agentId]: text }));
      if (!res.ok) throw new Error(text);
      await load();
    } catch (e) {
      setErr(String(e));
    } finally {
      setRunning((prev) => ({ ...prev, [agentId]: { plan: false, audit: false } }));
    }
  };

  const setGlobalControl = async (payload: { enabled?: boolean; emergency?: boolean }) => {
    setErr(null);
    try {
      const res = await fetch(withBase("/emergency"), {
        method: "POST",
        headers: jsonHeaders,
        body: JSON.stringify(payload),
      });
      const text = await res.text();
      if (!res.ok) throw new Error(text);
      await load();
    } catch (e) {
      setErr(String(e));
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>AI 機器人控制（20 位）</CardTitle>
          <CardDescription>主站後台直接控制，不再依賴 iframe。可直接設定帳密、Prompt、計畫與稽核。</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-2 lg:grid-cols-[1fr_240px_140px]">
            <Input
              value={apiBaseInput}
              onChange={(e) => setApiBaseInput(e.target.value)}
              placeholder={resolveDefaultApiBase()}
              className="font-mono text-sm"
            />
            <Input
              type="password"
              value={secret}
              onChange={(e) => setSecret(e.target.value)}
              placeholder="ADMIN_SECRET（可選）"
            />
            <Button type="button" onClick={applyApiBase}>套用 API</Button>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" onClick={() => void load()}>重新載入</Button>
            <Button type="button" onClick={() => void setGlobalControl({ enabled: true })}>啟用執行</Button>
            <Button type="button" variant="outline" onClick={() => void setGlobalControl({ enabled: false })}>停用執行</Button>
            <Button type="button" onClick={() => void setGlobalControl({ emergency: true })}>緊急剎車</Button>
            <Button type="button" variant="outline" onClick={() => void setGlobalControl({ emergency: false })}>解除剎車</Button>
          </div>

          {control && (
            <p className="text-sm text-muted-foreground">
              執行狀態：{control.effectiveStopped ? "停止中" : "可執行"}（enabled={String(control.enabled)} / emergency={String(control.emergency)}）
            </p>
          )}
          {err && <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">{err}</div>}
        </CardContent>
      </Card>

      <div className="grid gap-3 lg:grid-cols-2">
        {AGENT_IDS.map((id) => {
          const cfg = configs[id] ?? emptyConfig(id);
          const state = running[id] ?? { plan: false, audit: false };
          return (
            <Card key={id}>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">{id}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <Input value={cfg.email} onChange={(e) => updateConfig(id, { email: e.target.value })} placeholder="Email" />
                <Input type="password" value={cfg.password} onChange={(e) => updateConfig(id, { password: e.target.value })} placeholder="Password" />
                <Textarea
                  value={cfg.behaviorPrompt}
                  onChange={(e) => updateConfig(id, { behaviorPrompt: e.target.value })}
                  placeholder="行為 Prompt"
                  rows={3}
                />
                <div className="flex flex-wrap gap-2">
                  <Button type="button" variant="outline" onClick={() => void saveConfig(id)}>儲存設定</Button>
                  <Button type="button" variant="outline" onClick={() => void generatePlan(id)}>生產計畫</Button>
                  <Button type="button" disabled={state.plan || state.audit} onClick={() => void trigger(id, "plan")}>
                    {state.plan ? "執行中..." : "執行主計畫"}
                  </Button>
                  <Button type="button" variant="outline" disabled={state.plan || state.audit} onClick={() => void trigger(id, "audit")}>
                    {state.audit ? "執行中..." : "執行稽核"}
                  </Button>
                </div>
                <div className="rounded border p-2 text-xs whitespace-pre-wrap">
                  <div className="font-semibold mb-1">預計執行計畫</div>
                  {plans[id] || "尚未生產計畫"}
                </div>
                <div className="rounded border p-2 text-xs whitespace-pre-wrap">
                  <div className="font-semibold mb-1">執行輸出</div>
                  {outputs[id] || "尚未執行"}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

export default AiAgentControlBridge;
