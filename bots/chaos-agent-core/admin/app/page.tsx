"use client";

import { useCallback, useEffect, useState } from "react";

type AgentRow = {
  id: string;
  emotion: Record<string, unknown> | null;
  logTail: string[];
};

type ControlState = {
  enabled: boolean;
  emergency: boolean;
  effectiveStopped: boolean;
};

export default function AdminPage() {
  const [secret, setSecret] = useState("");
  const [dataRoot, setDataRoot] = useState("");
  const [agents, setAgents] = useState<AgentRow[]>([]);
  const [control, setControl] = useState<ControlState | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [runOutput, setRunOutput] = useState<string>("");
  const [runningPlan, setRunningPlan] = useState(false);
  const [runningAudit, setRunningAudit] = useState(false);

  const headers = () => {
    const h: Record<string, string> = {};
    if (secret) h["x-admin-secret"] = secret;
    return h;
  };

  const load = useCallback(async () => {
    setErr(null);
    try {
      const res = await fetch("/api/agents", { headers: headers() });
      if (!res.ok) {
        setErr(await res.text());
        return;
      }
      const j = (await res.json()) as {
        dataRoot: string;
        control: ControlState;
        agents: AgentRow[];
      };
      setDataRoot(j.dataRoot);
      setControl(j.control);
      setAgents(j.agents);
    } catch (e) {
      setErr(String(e));
    }
  }, [secret]);

  useEffect(() => {
    void load();
  }, [load]);

  const postEmergency = async (payload: { emergency?: boolean; enabled?: boolean }) => {
    setErr(null);
    const res = await fetch("/api/emergency", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...headers() },
      body: JSON.stringify(payload)
    });
    if (!res.ok) {
      throw new Error(await res.text());
    }
    await load();
  };

  const trigger = async (kind: "plan" | "audit") => {
    setErr(null);
    setRunOutput("");
    if (kind === "plan") setRunningPlan(true);
    if (kind === "audit") setRunningAudit(true);
    try {
      const res = await fetch(kind === "plan" ? "/api/run-plan" : "/api/run-audit", {
        method: "POST",
        headers: headers()
      });
      const text = await res.text();
      setRunOutput(text);
      if (!res.ok) {
        throw new Error(text);
      }
      await load();
    } catch (e) {
      setErr(String(e));
    } finally {
      if (kind === "plan") setRunningPlan(false);
      if (kind === "audit") setRunningAudit(false);
    }
  };

  return (
    <main style={{ maxWidth: 980 }}>
      <h1 style={{ marginTop: 0 }}>Chaos Agent 管理後台</h1>
      <p style={{ opacity: 0.85, lineHeight: 1.6 }}>
        僅後台可觸發。預設停止（需先「啟用執行」），再按按鈕才會執行。主 App 不會直接觸發。
      </p>

      <section style={{ marginBottom: "1.25rem" }}>
        <p style={{ marginTop: 0 }}>
          <a href="/agents-control" style={{ color: "#93c5fd" }}>
            前往「20 位 AI 機器人控制頁」
          </a>
        </p>
        <label>
          ADMIN_SECRET（若後端有設定）：{" "}
          <input
            type="password"
            value={secret}
            onChange={(e) => setSecret(e.target.value)}
            style={{ width: 280, padding: "0.35rem 0.5rem" }}
          />
        </label>{" "}
        <button type="button" onClick={() => void load()}>
          重新載入
        </button>
      </section>

      {err && <pre style={{ color: "#f87171", whiteSpace: "pre-wrap" }}>{err}</pre>}

      <section style={{ marginBottom: "1.5rem" }}>
        <h2>全域控制</h2>
        <p><strong>data 根目錄</strong>：{dataRoot || "—"}</p>
        <p>
          <strong>執行狀態</strong>：
          {control == null
            ? "—"
            : control.effectiveStopped
              ? "停止中（不可執行）"
              : "可執行"}
          {control?.emergency ? "（緊急剎車中）" : ""}
        </p>
        <button type="button" onClick={() => void postEmergency({ enabled: true })} style={{ marginRight: 8 }}>
          啟用執行
        </button>
        <button type="button" onClick={() => void postEmergency({ enabled: false })} style={{ marginRight: 8 }}>
          停用執行
        </button>
        <button type="button" onClick={() => void postEmergency({ emergency: true })} style={{ marginRight: 8 }}>
          緊急剎車
        </button>
        <button type="button" onClick={() => void postEmergency({ emergency: false })}>
          解除剎車
        </button>
      </section>

      <section style={{ marginBottom: "1.5rem" }}>
        <h2>手動觸發（按鈕驅動）</h2>
        <button
          type="button"
          disabled={runningPlan || !!control?.effectiveStopped}
          onClick={() => void trigger("plan")}
          style={{ marginRight: 8 }}
        >
          {runningPlan ? "執行主計畫中..." : "執行主計畫"}
        </button>
        <button
          type="button"
          disabled={runningAudit || !!control?.effectiveStopped}
          onClick={() => void trigger("audit")}
        >
          {runningAudit ? "執行自我稽核中..." : "執行自我稽核"}
        </button>

        {runOutput && (
          <>
            <h4 style={{ marginBottom: "0.5rem", marginTop: "1rem" }}>執行輸出</h4>
            <pre style={{ whiteSpace: "pre-wrap", background: "#111", padding: "0.75rem", borderRadius: 8 }}>
              {runOutput}
            </pre>
          </>
        )}
      </section>

      <section>
        <h2>機器人狀態（{agents.length}）</h2>
        {agents.length === 0 && <p>尚無代理目錄，或尚未執行過代理程式。</p>}
        {agents.map((a) => (
          <article
            key={a.id}
            style={{
              border: "1px solid #333",
              borderRadius: 8,
              padding: "1rem",
              marginBottom: "1rem",
              background: "#161922"
            }}
          >
            <h3 style={{ marginTop: 0 }}>{a.id}</h3>
            <h4 style={{ marginBottom: "0.5rem" }}>emotion.json</h4>
            <pre style={{ overflow: "auto", fontSize: 12 }}>
              {a.emotion ? JSON.stringify(a.emotion, null, 2) : "（無檔案）"}
            </pre>
            <h4 style={{ marginBottom: "0.5rem" }}>internal_logs 末 25 行</h4>
            <pre style={{ overflow: "auto", fontSize: 11, opacity: 0.9 }}>
              {a.logTail.length ? a.logTail.join("\n") : "（無）"}
            </pre>
          </article>
        ))}
      </section>
    </main>
  );
}

