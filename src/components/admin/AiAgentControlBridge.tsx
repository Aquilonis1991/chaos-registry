import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

/** 獨立啟動 chaos-agent-core/admin 時常見埠（僅作說明／手動填寫用） */
const STANDALONE_EXAMPLE = "http://127.0.0.1:3001/agents-control";

function resolveDefaultAgentAdminUrl(): string {
  const envBase = import.meta.env.VITE_AGENT_ADMIN_BASE as string | undefined;
  if (envBase && envBase.trim().length > 0) {
    return `${envBase.replace(/\/$/, "")}/agents-control`;
  }
  if (typeof window !== "undefined") {
    // 與 vite proxy `/agent-admin` 同源，避免 HTTPS 主站嵌入 http 被擋（混合內容）
    return `${window.location.origin}/agent-admin/agents-control`;
  }
  return STANDALONE_EXAMPLE;
}

function isLikelyMixedContentBlocked(pageHttps: boolean, iframeSrc: string): boolean {
  if (!pageHttps) return false;
  try {
    const u = new URL(iframeSrc, typeof window !== "undefined" ? window.location.href : "https://example.com");
    return u.protocol === "http:";
  } catch {
    return false;
  }
}

export function AiAgentControlBridge() {
  const [url, setUrl] = useState(() => {
    if (typeof window === "undefined") return resolveDefaultAgentAdminUrl();
    const stored = window.localStorage.getItem("agent_admin_url");
    if (stored && stored.trim()) return stored.trim();
    return resolveDefaultAgentAdminUrl();
  });
  const [appliedUrl, setAppliedUrl] = useState(() => {
    if (typeof window === "undefined") return resolveDefaultAgentAdminUrl();
    const stored = window.localStorage.getItem("agent_admin_url");
    if (stored && stored.trim()) return stored.trim();
    return resolveDefaultAgentAdminUrl();
  });

  /** 若曾存過 http://localhost，在 HTTPS 站會無法顯示，自動改為同源 proxy 或環境變數網址 */
  useEffect(() => {
    if (typeof window === "undefined") return;
    const https = window.location.protocol === "https:";
    const stored = window.localStorage.getItem("agent_admin_url");
    if (!stored || !stored.trim()) return;
    if (isLikelyMixedContentBlocked(https, stored)) {
      const next = resolveDefaultAgentAdminUrl();
      setUrl(next);
      setAppliedUrl(next);
      window.localStorage.setItem("agent_admin_url", next);
    }
  }, []);

  const iframeUrl = useMemo(() => {
    const trimmed = appliedUrl.trim();
    return trimmed || resolveDefaultAgentAdminUrl();
  }, [appliedUrl]);

  const mixedBlocked = useMemo(() => {
    if (typeof window === "undefined") return false;
    return isLikelyMixedContentBlocked(window.location.protocol === "https:", iframeUrl);
  }, [iframeUrl]);

  const applyUrl = () => {
    const next = url.trim() || resolveDefaultAgentAdminUrl();
    setAppliedUrl(next);
    if (typeof window !== "undefined") {
      window.localStorage.setItem("agent_admin_url", next);
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>AI 機器人控制（20 位）</CardTitle>
          <CardDescription>
            與「用戶管理 / 主題管理」同層級入口。開發時請先在本機啟動{" "}
            <code className="text-xs bg-muted px-1 rounded">bots/chaos-agent-core/admin</code>（預設埠 3001），主站
            dev 會透過 Vite 將 <code className="text-xs bg-muted px-1 rounded">/agent-admin</code> 轉發過去，iframe
            才能同源顯示。
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {mixedBlocked && (
            <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              目前為 HTTPS 頁面，但嵌入網址為 HTTP，瀏覽器會阻擋顯示（混合內容）。請改為同源路徑（例如預設的{" "}
              <code className="text-xs">/agent-admin/agents-control</code>）或設定{" "}
              <code className="text-xs">VITE_AGENT_ADMIN_BASE</code> 指向 HTTPS 的獨立後台，再按「載入控制頁」。
            </div>
          )}
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <Input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder={resolveDefaultAgentAdminUrl()}
              className="font-mono text-sm"
            />
            <div className="flex shrink-0 gap-2">
              <Button type="button" onClick={applyUrl}>
                載入控制頁
              </Button>
              <Button type="button" variant="outline" onClick={() => window.open(iframeUrl, "_blank")}>
                新分頁開啟
              </Button>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            預設使用同源 <code className="text-xs">/agent-admin/agents-control</code>（需 dev 代理或正式環境反向代理）。獨立網址範例：{" "}
            {STANDALONE_EXAMPLE}。正式站建置可設定環境變數{" "}
            <code className="text-xs">VITE_AGENT_ADMIN_BASE=https://你的-agent-後台網域</code>。
          </p>
        </CardContent>
      </Card>

      <div className="rounded-md border bg-background overflow-hidden">
        <iframe
          title="AI Agent Control"
          src={iframeUrl}
          className="w-full"
          style={{ minHeight: "75vh", border: "0" }}
        />
      </div>
    </div>
  );
}

export default AiAgentControlBridge;
