"use client";

import { useEffect, useMemo, useState } from "react";

const AGENT_IDS = Array.from({ length: 20 }, (_, idx) =>
  `agent-${String(idx + 1).padStart(2, "0")}`
);

type RunningMap = Record<string, { plan: boolean; audit: boolean }>;
type OutputMap = Record<string, string>;
type PlanMap = Record<string, string>;
type AgentConfig = {
  agentId: string;
  email: string;
  password: string;
  behaviorPrompt: string;
};
type ConfigMap = Record<string, AgentConfig>;

function emptyConfig(agentId: string): AgentConfig {
  return { agentId, email: "", password: "", behaviorPrompt: "" };
}

export default function AgentsControlPage() {
  const [secret, setSecret] = useState("");
  const [running, setRunning] = useState<RunningMap>({});
  const [output, setOutput] = useState<OutputMap>({});
  const [plans, setPlans] = useState<PlanMap>({});
  const [configs, setConfigs] = useState<ConfigMap>({});
  const [error, setError] = useState<string | null>(null);

  const headerBag = useMemo(() => {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (secret.trim()) headers["x-admin-secret"] = secret.trim();
    return headers;
  }, [secret]);

  async function loadConfigs() {
    setError(null);
    try {
      const res = await fetch("/api/agent-configs", { headers: headerBag });
      const body = (await res.json()) as { configs?: ConfigMap; error?: string };
      if (!res.ok) {
        throw new Error(body.error || "讀取設定失敗");
      }
      const loaded: ConfigMap = {};
      for (const id of AGENT_IDS) {
        loaded[id] = body.configs?.[id] ?? emptyConfig(id);
      }
      setConfigs(loaded);
    } catch (e) {
      setError(String(e));
    }
  }

  useEffect(() => {
    void loadConfigs();
  }, [secret]);

  function updateConfig(agentId: string, patch: Partial<AgentConfig>) {
    setConfigs((prev) => ({
      ...prev,
      [agentId]: { ...(prev[agentId] ?? emptyConfig(agentId)), ...patch, agentId }
    }));
  }

  async function saveConfig(agentId: string) {
    setError(null);
    const cfg = configs[agentId] ?? emptyConfig(agentId);
    try {
      const res = await fetch("/api/agent-configs", {
        method: "POST",
        headers: headerBag,
        body: JSON.stringify(cfg)
      });
      const body = await res.text();
      if (!res.ok) throw new Error(body);
      setOutput((prev) => ({ ...prev, [agentId]: `設定已儲存\n${body}` }));
    } catch (e) {
      setError(String(e));
    }
  }

  async function generatePlan(agentId: string) {
    setError(null);
    try {
      const res = await fetch("/api/generate-plan", {
        method: "POST",
        headers: headerBag,
        body: JSON.stringify({ agentId })
      });
      const body = (await res.json()) as { plan?: string; error?: string };
      if (!res.ok) throw new Error(body.error || "生產計劃失敗");
      setPlans((prev) => ({ ...prev, [agentId]: body.plan ?? "" }));
    } catch (e) {
      setError(String(e));
    }
  }

  async function trigger(agentId: string, kind: "plan" | "audit") {
    setError(null);
    setRunning((prev) => ({
      ...prev,
      [agentId]: { plan: kind === "plan", audit: kind === "audit" }
    }));

    try {
      const cfg = configs[agentId] ?? emptyConfig(agentId);
      const res = await fetch(kind === "plan" ? "/api/run-plan" : "/api/run-audit", {
        method: "POST",
        headers: headerBag,
        body: JSON.stringify({
          agentId,
          email: cfg.email,
          password: cfg.password,
          behaviorPrompt: cfg.behaviorPrompt
        })
      });
      const text = await res.text();
      setOutput((prev) => ({ ...prev, [agentId]: text }));
      if (!res.ok) {
        throw new Error(text);
      }
    } catch (e) {
      setError(String(e));
    } finally {
      setRunning((prev) => ({
        ...prev,
        [agentId]: { plan: false, audit: false }
      }));
    }
  }

  return (
    <main style={{ maxWidth: 1200 }}>
      <h1 style={{ marginTop: 0 }}>20 位 AI 機器人控制頁</h1>
      <p style={{ opacity: 0.85, lineHeight: 1.6 }}>
        可針對單一機器人手動觸發「主計畫」或「自我稽核」。實際是否可執行仍受 RUN_ENABLED 與 EMERGENCY_STOP 控制。
      </p>

      <section style={{ marginBottom: "1rem" }}>
        <p style={{ marginTop: 0 }}>
          <a href="/" style={{ color: "#93c5fd" }}>
            返回總覽後台
          </a>
        </p>
        <label>
          ADMIN_SECRET（若後端有設定）：{" "}
          <input
            type="password"
            value={secret}
            onChange={(e) => setSecret(e.target.value)}
            style={{ width: 300, padding: "0.35rem 0.5rem" }}
          />
        </label>
      </section>

      {error && <pre style={{ color: "#f87171", whiteSpace: "pre-wrap" }}>{error}</pre>}

      <section
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))",
          gap: "0.8rem"
        }}
      >
        {AGENT_IDS.map((id) => {
          const state = running[id] ?? { plan: false, audit: false };
          return (
            <article
              key={id}
              style={{
                border: "1px solid #333",
                borderRadius: 8,
                padding: "0.9rem",
                background: "#161922"
              }}
            >
              <h3 style={{ marginTop: 0, marginBottom: "0.5rem" }}>{id}</h3>
              <label style={{ display: "block", marginBottom: 6 }}>
                帳號（Email）
                <input
                  type="email"
                  value={(configs[id] ?? emptyConfig(id)).email}
                  onChange={(e) => updateConfig(id, { email: e.target.value })}
                  style={{ width: "100%", padding: "0.35rem 0.5rem", marginTop: 4 }}
                  placeholder="agent@example.com"
                />
              </label>
              <label style={{ display: "block", marginBottom: 6 }}>
                密碼
                <input
                  type="password"
                  value={(configs[id] ?? emptyConfig(id)).password}
                  onChange={(e) => updateConfig(id, { password: e.target.value })}
                  style={{ width: "100%", padding: "0.35rem 0.5rem", marginTop: 4 }}
                  placeholder="••••••••"
                />
              </label>
              <label style={{ display: "block", marginBottom: 8 }}>
                行為 Prompt
                <textarea
                  value={(configs[id] ?? emptyConfig(id)).behaviorPrompt}
                  onChange={(e) => updateConfig(id, { behaviorPrompt: e.target.value })}
                  rows={3}
                  style={{ width: "100%", padding: "0.35rem 0.5rem", marginTop: 4, resize: "vertical" }}
                  placeholder="例如：偏理性、短句、先同理再提出反方觀點"
                />
              </label>
              <div style={{ display: "flex", gap: "0.5rem", marginBottom: "0.6rem", flexWrap: "wrap" }}>
                <button type="button" onClick={() => void saveConfig(id)}>
                  儲存帳密與 Prompt
                </button>
                <button type="button" onClick={() => void generatePlan(id)}>
                  生產計劃
                </button>
              </div>
              <h4 style={{ margin: "0.4rem 0" }}>預計執行計畫</h4>
              <pre
                style={{
                  margin: 0,
                  minHeight: 74,
                  maxHeight: 160,
                  overflow: "auto",
                  whiteSpace: "pre-wrap",
                  fontSize: 11,
                  opacity: 0.9,
                  marginBottom: "0.6rem"
                }}
              >
                {plans[id] || "尚未生產計劃"}
              </pre>
              <div style={{ display: "flex", gap: "0.5rem", marginBottom: "0.6rem" }}>
                <button
                  type="button"
                  disabled={state.plan || state.audit}
                  onClick={() => void trigger(id, "plan")}
                >
                  {state.plan ? "執行中..." : "執行主計畫"}
                </button>
                <button
                  type="button"
                  disabled={state.plan || state.audit}
                  onClick={() => void trigger(id, "audit")}
                >
                  {state.audit ? "執行中..." : "執行自我稽核"}
                </button>
              </div>
              <pre
                style={{
                  margin: 0,
                  minHeight: 80,
                  maxHeight: 160,
                  overflow: "auto",
                  whiteSpace: "pre-wrap",
                  fontSize: 11,
                  opacity: 0.9
                }}
              >
                {output[id] || "尚未執行"}
              </pre>
            </article>
          );
        })}
      </section>
    </main>
  );
}
