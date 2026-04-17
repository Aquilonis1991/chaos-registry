import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

const DEFAULT_AGENT_ADMIN_URL = "http://localhost:3001/agents-control";

export function AiAgentControlBridge() {
  const initialUrl =
    typeof window !== "undefined"
      ? window.localStorage.getItem("agent_admin_url") || DEFAULT_AGENT_ADMIN_URL
      : DEFAULT_AGENT_ADMIN_URL;
  const [url, setUrl] = useState(initialUrl);
  const [appliedUrl, setAppliedUrl] = useState(initialUrl);

  const iframeUrl = useMemo(() => {
    const trimmed = appliedUrl.trim();
    return trimmed || DEFAULT_AGENT_ADMIN_URL;
  }, [appliedUrl]);

  const applyUrl = () => {
    const next = url.trim() || DEFAULT_AGENT_ADMIN_URL;
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
            與「用戶管理 / 主題管理」同層級入口。下方內嵌獨立機器人控制頁，可直接在此操作。
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex gap-2">
            <Input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder={DEFAULT_AGENT_ADMIN_URL}
            />
            <Button type="button" onClick={applyUrl}>
              載入控制頁
            </Button>
            <Button type="button" variant="outline" onClick={() => window.open(iframeUrl, "_blank")}>
              新分頁開啟
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            若你的 agent-admin 不是跑在 3001，請改成正確網址後按「載入控制頁」。
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
