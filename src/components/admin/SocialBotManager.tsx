import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Loader2, Save, Send, Megaphone } from "lucide-react";
import { useSystemConfig } from "@/hooks/useSystemConfig";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type Platform = "x" | "threads" | "facebook";
const PLATFORMS: { key: Platform; label: string }[] = [
  { key: "x", label: "X (Twitter)" },
  { key: "threads", label: "Threads" },
  { key: "facebook", label: "Facebook" },
];

type PromptByLang = { zh: string; en: string; ja: string };

function parsePlatformToggles(value: unknown): Record<Platform, boolean> {
  const o = (value && typeof value === "object" ? value : {}) as Record<string, unknown>;
  return {
    x: o.x !== false,
    threads: o.threads !== false,
    facebook: o.facebook !== false,
  };
}

function parsePromptValue(value: unknown): PromptByLang {
  if (value && typeof value === "object" && "zh" in (value as object)) {
    const o = value as Record<string, unknown>;
    return {
      zh: typeof o.zh === "string" ? o.zh : "",
      en: typeof o.en === "string" ? o.en : "",
      ja: typeof o.ja === "string" ? o.ja : "",
    };
  }
  return { zh: "", en: "", ja: "" };
}

type PostLogRow = {
  id: string;
  platform: Platform;
  mode: "test" | "live";
  content: string;
  status: "generated" | "blocked" | "posted" | "failed";
  error: string | null;
  created_at: string;
};

type RunResult = {
  platform: Platform;
  status: "generated" | "blocked" | "posted" | "failed";
  content: string;
  error?: string;
};

const STATUS_VARIANT: Record<PostLogRow["status"], "default" | "secondary" | "destructive" | "outline"> = {
  posted: "default",
  generated: "secondary",
  blocked: "outline",
  failed: "destructive",
};

export const SocialBotManager = () => {
  const { configs, loading, updateConfig, fetchConfigs } = useSystemConfig();
  const [platformToggles, setPlatformToggles] = useState<Record<Platform, boolean>>({ x: true, threads: true, facebook: true });
  const [promptByLang, setPromptByLang] = useState<PromptByLang>({ zh: "", en: "", ja: "" });
  const [isSaving, setIsSaving] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [isLiveRunning, setIsLiveRunning] = useState(false);
  const [lastResults, setLastResults] = useState<RunResult[] | null>(null);
  const [lastRunMode, setLastRunMode] = useState<"test" | "live" | null>(null);
  const [logRows, setLogRows] = useState<PostLogRow[]>([]);
  const [logsLoading, setLogsLoading] = useState(true);

  useEffect(() => {
    if (loading) return;
    const platformsConfig = configs.find((c) => c.key === "social_bot_platforms");
    const promptConfig = configs.find((c) => c.key === "social_bot_prompt");
    if (platformsConfig) setPlatformToggles(parsePlatformToggles(platformsConfig.value));
    if (promptConfig) setPromptByLang(parsePromptValue(promptConfig.value));
  }, [configs, loading]);

  const fetchLogs = async () => {
    setLogsLoading(true);
    const { data, error } = await supabase
      .from("social_bot_posts")
      .select("id, platform, mode, content, status, error, created_at")
      .order("created_at", { ascending: false })
      .limit(20);
    if (error) {
      console.error("[SocialBotManager] fetch logs error:", error);
    } else {
      setLogRows((data as PostLogRow[]) || []);
    }
    setLogsLoading(false);
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  const handleSavePlatforms = async () => {
    const config = configs.find((c) => c.key === "social_bot_platforms");
    if (!config) {
      toast.error("找不到 social_bot_platforms 設定，請先執行資料庫 migration");
      return;
    }
    setIsSaving(true);
    try {
      const success = await updateConfig(config.id, platformToggles);
      if (success) fetchConfigs();
    } finally {
      setIsSaving(false);
    }
  };

  const handleSavePrompt = async () => {
    const config = configs.find((c) => c.key === "social_bot_prompt");
    if (!config) {
      toast.error("找不到 social_bot_prompt 設定，請先執行資料庫 migration");
      return;
    }
    setIsSaving(true);
    try {
      const success = await updateConfig(config.id, promptByLang);
      if (success) fetchConfigs();
    } finally {
      setIsSaving(false);
    }
  };

  const handleTestRun = async () => {
    setIsRunning(true);
    setLastResults(null);
    try {
      const enabledPlatforms = PLATFORMS.filter((p) => platformToggles[p.key]).map((p) => p.key);
      if (enabledPlatforms.length === 0) {
        toast.error("請至少啟用一個平台");
        return;
      }

      const { data, error } = await supabase.functions.invoke("social-post-bot", {
        body: { mode: "test", platforms: enabledPlatforms },
      });

      if (error) throw error;
      if (data.error) throw new Error(data.error);

      setLastResults(data.results as RunResult[]);
      setLastRunMode("test");
      toast.success("測試發文完成，請查看下方結果與紀錄");
      fetchLogs();
    } catch (err) {
      console.error("[SocialBotManager] test run error:", err);
      toast.error(err instanceof Error ? err.message : "測試發文失敗");
    } finally {
      setIsRunning(false);
    }
  };

  const handleLiveRun = async () => {
    setIsLiveRunning(true);
    setLastResults(null);
    try {
      const enabledPlatforms = PLATFORMS.filter((p) => platformToggles[p.key]).map((p) => p.key);
      if (enabledPlatforms.length === 0) {
        toast.error("請至少啟用一個平台");
        return;
      }

      const { data, error } = await supabase.functions.invoke("social-post-bot", {
        body: { mode: "live", platforms: enabledPlatforms },
      });

      if (error) throw error;
      if (data.error) throw new Error(data.error);

      setLastResults(data.results as RunResult[]);
      setLastRunMode("live");
      toast.success("正式發文完成，請查看下方結果與紀錄");
      fetchLogs();
    } catch (err) {
      console.error("[SocialBotManager] live run error:", err);
      toast.error(err instanceof Error ? err.message : "正式發文失敗");
    } finally {
      setIsLiveRunning(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin" />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>宣傳機器人 — 平台設定</CardTitle>
          <CardDescription>
            控制哪些平台啟用，以及 AI 生成貼文所用的品牌語氣 prompt。目前僅支援手動觸發「測試發文」（打真實 API、使用 TEST_ 開頭的沙盒帳號憑證），尚未接上排程自動發布。
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex flex-wrap gap-6">
            {PLATFORMS.map((p) => (
              <div key={p.key} className="flex items-center gap-2">
                <Checkbox
                  id={`platform-${p.key}`}
                  checked={platformToggles[p.key]}
                  onCheckedChange={(checked) =>
                    setPlatformToggles((prev) => ({ ...prev, [p.key]: checked === true }))
                  }
                />
                <Label htmlFor={`platform-${p.key}`}>{p.label}</Label>
              </div>
            ))}
            <Button size="sm" variant="outline" onClick={handleSavePlatforms} disabled={isSaving}>
              <Save className="w-4 h-4 mr-1" />
              儲存平台設定
            </Button>
          </div>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="social-prompt-zh">繁中 (zh)</Label>
              <Textarea
                id="social-prompt-zh"
                value={promptByLang.zh}
                onChange={(e) => setPromptByLang((prev) => ({ ...prev, zh: e.target.value }))}
                className="font-mono text-sm leading-relaxed p-4 w-full"
                style={{ minHeight: "140px" }}
                placeholder="繁體中文品牌語氣 prompt..."
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="social-prompt-en">English (en)</Label>
              <Textarea
                id="social-prompt-en"
                value={promptByLang.en}
                onChange={(e) => setPromptByLang((prev) => ({ ...prev, en: e.target.value }))}
                className="font-mono text-sm leading-relaxed p-4 w-full"
                style={{ minHeight: "100px" }}
                placeholder="English brand-voice prompt (optional)..."
              />
            </div>
            <div className="flex justify-end">
              <Button size="sm" onClick={handleSavePrompt} disabled={isSaving}>
                {isSaving ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Save className="w-4 h-4 mr-1" />}
                儲存 Prompt
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>產生貼文</CardTitle>
          <CardDescription>
            會呼叫 Grok 依上方 prompt 生成各平台文案，通過禁字檢查後發布。「產生測試貼文」用 <code>TEST_</code> 開頭的沙盒帳號憑證；「正式發文」用不加前綴的正式帳號憑證，會真的發布到官方帳號，請先確認品牌語氣 prompt 沒問題再按。憑證設定見 docs/SOCIAL_BOT_SETUP.md。
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-3">
            <Button onClick={handleTestRun} disabled={isRunning || isLiveRunning}>
              {isRunning ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Send className="w-4 h-4 mr-1" />}
              產生測試貼文
            </Button>

            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" disabled={isRunning || isLiveRunning}>
                  {isLiveRunning ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Megaphone className="w-4 h-4 mr-1" />}
                  正式發文
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>確定要正式發文嗎？</AlertDialogTitle>
                  <AlertDialogDescription>
                    這會用正式帳號憑證，把 AI 生成的內容真的發布到目前勾選啟用的平台官方帳號上，公開可見且無法透過這個後台撤回。請先確認上方的品牌語氣 prompt 內容沒問題。
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>取消</AlertDialogCancel>
                  <AlertDialogAction onClick={handleLiveRun}>確定發文</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>

          {lastResults && (
            <div className="space-y-2">
              {lastRunMode && (
                <p className="text-xs text-muted-foreground">
                  以下是「{lastRunMode === "live" ? "正式發文" : "測試發文"}」的結果：
                </p>
              )}
              {lastResults.map((r) => (
                <div key={r.platform} className="border rounded-md p-3">
                  <div className="flex items-center gap-2 mb-1">
                    <Badge variant={STATUS_VARIANT[r.status]}>{r.platform}</Badge>
                    <Badge variant={STATUS_VARIANT[r.status]}>{r.status}</Badge>
                  </div>
                  <p className="text-sm whitespace-pre-wrap">{r.content}</p>
                  {r.error && <p className="text-xs text-destructive mt-1">{r.error}</p>}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>發文紀錄</CardTitle>
          <CardDescription>最近 20 筆（測試與正式）</CardDescription>
        </CardHeader>
        <CardContent>
          {logsLoading ? (
            <div className="flex items-center justify-center py-6">
              <Loader2 className="w-5 h-5 animate-spin" />
            </div>
          ) : logRows.length === 0 ? (
            <p className="text-sm text-muted-foreground">尚無紀錄</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>時間</TableHead>
                  <TableHead>平台</TableHead>
                  <TableHead>模式</TableHead>
                  <TableHead>狀態</TableHead>
                  <TableHead>內容</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logRows.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="text-xs whitespace-nowrap">
                      {new Date(row.created_at).toLocaleString()}
                    </TableCell>
                    <TableCell>{row.platform}</TableCell>
                    <TableCell>{row.mode}</TableCell>
                    <TableCell>
                      <Badge variant={STATUS_VARIANT[row.status]}>{row.status}</Badge>
                    </TableCell>
                    <TableCell className="max-w-md truncate" title={row.content}>
                      {row.error ? `${row.content} — ${row.error}` : row.content}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default SocialBotManager;
