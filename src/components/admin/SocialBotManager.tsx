import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
import { Loader2, Save, Sparkles, Megaphone, FlaskConical, Clock } from "lucide-react";
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

type PostStatus = "generated" | "blocked" | "posted" | "failed";

type PostLogRow = {
  id: string;
  platform: Platform;
  mode: "test" | "live";
  content: string;
  status: PostStatus;
  error: string | null;
  created_at: string;
};

type DraftEntry = {
  content: string;
  status: PostStatus;
  error?: string;
};

type PublishResult = {
  platform: Platform;
  status: PostStatus;
  content: string;
  error?: string;
};

const STATUS_VARIANT: Record<PostStatus, "default" | "secondary" | "destructive" | "outline"> = {
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

  const [isGenerating, setIsGenerating] = useState(false);
  const [draft, setDraft] = useState<Partial<Record<Platform, DraftEntry>> | null>(null);
  const [draftDebug, setDraftDebug] = useState<{ trendingTopicsFound: number; trendingTopics: { title: string; end_at: string; total_votes: number }[] } | null>(null);

  const [isPublishingTest, setIsPublishingTest] = useState(false);
  const [isPublishingLive, setIsPublishingLive] = useState(false);
  const [publishResults, setPublishResults] = useState<PublishResult[] | null>(null);
  const [lastPublishMode, setLastPublishMode] = useState<"test" | "live" | null>(null);

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

  const handleGenerateDraft = async () => {
    setIsGenerating(true);
    setDraft(null);
    setDraftDebug(null);
    setPublishResults(null);
    try {
      const enabledPlatforms = PLATFORMS.filter((p) => platformToggles[p.key]).map((p) => p.key);
      if (enabledPlatforms.length === 0) {
        toast.error("請至少啟用一個平台");
        return;
      }

      const { data, error } = await supabase.functions.invoke("social-post-bot", {
        body: { action: "generate", platforms: enabledPlatforms },
      });

      if (error) throw error;
      if (data.error) throw new Error(data.error);

      const next: Partial<Record<Platform, DraftEntry>> = {};
      for (const r of data.results as PublishResult[]) {
        next[r.platform] = { content: r.content, status: r.status, error: r.error };
      }
      setDraft(next);
      if (data.debug) setDraftDebug(data.debug);
      toast.success("草稿已產生，確認內容沒問題後再按下方按鈕發布");
    } catch (err) {
      console.error("[SocialBotManager] generate draft error:", err);
      toast.error(err instanceof Error ? err.message : "產生草稿失敗");
    } finally {
      setIsGenerating(false);
    }
  };

  const updateDraftContent = (platform: Platform, content: string) => {
    setDraft((prev) => (prev ? { ...prev, [platform]: { ...prev[platform]!, content } } : prev));
  };

  const handlePublish = async (mode: "test" | "live") => {
    if (!draft) return;
    const setBusy = mode === "test" ? setIsPublishingTest : setIsPublishingLive;
    setBusy(true);
    setPublishResults(null);
    try {
      const platformsToPublish = (Object.keys(draft) as Platform[]).filter(
        (p) => draft[p] && draft[p]!.content.trim() && draft[p]!.status !== "blocked"
      );
      if (platformsToPublish.length === 0) {
        toast.error("沒有可發布的草稿內容（可能都被違禁字擋下或是空的）");
        return;
      }

      const content: Partial<Record<Platform, string>> = {};
      for (const p of platformsToPublish) content[p] = draft[p]!.content;

      const { data, error } = await supabase.functions.invoke("social-post-bot", {
        body: { action: "publish", mode, platforms: platformsToPublish, content },
      });

      if (error) throw error;
      if (data.error) throw new Error(data.error);

      setPublishResults(data.results as PublishResult[]);
      setLastPublishMode(mode);
      toast.success(mode === "live" ? "正式發布完成，請查看下方結果與紀錄" : "測試發布完成，請查看下方結果與紀錄");
      fetchLogs();
    } catch (err) {
      console.error("[SocialBotManager] publish error:", err);
      toast.error(err instanceof Error ? err.message : "發布失敗");
    } finally {
      setBusy(false);
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

  const draftPlatforms = draft ? (Object.keys(draft) as Platform[]) : [];
  const hasPublishableDraft = draftPlatforms.some((p) => draft?.[p]?.content.trim() && draft[p]?.status !== "blocked");

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>宣傳機器人 — 平台設定</CardTitle>
          <CardDescription>
            控制哪些平台啟用，以及 AI 生成貼文所用的品牌語氣 prompt。流程是「產生草稿 → 人工確認/編輯 → 按按鈕才會真的發布」，AI 生成的內容不會自動送出。
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
          <CardTitle>1. 產生草稿</CardTitle>
          <CardDescription>
            呼叫 Grok 依上方 prompt 生成各平台文案、跑過違禁字檢查，但**不會發文**。生成後可以直接編輯下方文字框的內容，滿意了再到步驟 2 發布。
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button onClick={handleGenerateDraft} disabled={isGenerating}>
            {isGenerating ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Sparkles className="w-4 h-4 mr-1" />}
            產生草稿
          </Button>

          {draftDebug && (
            <div className="text-xs text-muted-foreground border rounded-md p-2 bg-muted/30">
              {draftDebug.trendingTopicsFound === 0 ? (
                <p>本次沒有找到符合條件的熱門話題（狀態 active 且距結束還有 2 小時以上），所以這次一定不會有連結——這不是 bug，資料庫裡目前沒有可引用的話題。</p>
              ) : (
                <>
                  <p>本次找到 {draftDebug.trendingTopicsFound} 個候選熱門話題（有連結出現的話會是連到這幾個之一）：</p>
                  <ul className="list-disc list-inside">
                    {draftDebug.trendingTopics.map((t, i) => (
                      <li key={i}>{t.title}（{t.total_votes} 票，結束時間 {new Date(t.end_at).toLocaleString()}）</li>
                    ))}
                  </ul>
                </>
              )}
            </div>
          )}

          {draftPlatforms.length > 0 && (
            <div className="space-y-3">
              {draftPlatforms.map((p) => {
                const entry = draft![p]!;
                return (
                  <div key={p} className="border rounded-md p-3 space-y-2">
                    <div className="flex items-center gap-2">
                      <Badge variant={STATUS_VARIANT[entry.status]}>{p}</Badge>
                      <Badge variant={STATUS_VARIANT[entry.status]}>{entry.status}</Badge>
                    </div>
                    {entry.error && <p className="text-xs text-destructive">{entry.error}</p>}
                    <Textarea
                      value={entry.content}
                      onChange={(e) => updateDraftContent(p, e.target.value)}
                      className="text-sm w-full"
                      style={{ minHeight: "100px" }}
                    />
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>2. 確認並發布</CardTitle>
          <CardDescription>
            確認上方草稿內容後才會真的呼叫平台 API 發文。「測試發布」用 <code>TEST_</code> 開頭的沙盒帳號憑證；「正式發布」用不加前綴的正式帳號憑證，會真的發布到官方帳號。憑證設定見 docs/SOCIAL_BOT_SETUP.md。
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-3">
            <Button
              variant="outline"
              onClick={() => handlePublish("test")}
              disabled={!hasPublishableDraft || isPublishingTest || isPublishingLive}
            >
              {isPublishingTest ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <FlaskConical className="w-4 h-4 mr-1" />}
              測試發布
            </Button>

            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" disabled={!hasPublishableDraft || isPublishingTest || isPublishingLive}>
                  {isPublishingLive ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Megaphone className="w-4 h-4 mr-1" />}
                  正式發布
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>確定要正式發布嗎？</AlertDialogTitle>
                  <AlertDialogDescription>
                    這會用正式帳號憑證，把上方草稿目前的內容（含你手動編輯過的部分）真的發布到官方帳號上，公開可見且無法透過這個後台撤回。
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>取消</AlertDialogCancel>
                  <AlertDialogAction onClick={() => handlePublish("live")}>確定發布</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>

          {!draft && <p className="text-sm text-muted-foreground">請先在步驟 1 產生草稿。</p>}

          {publishResults && (
            <div className="space-y-2">
              {lastPublishMode && (
                <p className="text-xs text-muted-foreground">
                  以下是「{lastPublishMode === "live" ? "正式發布" : "測試發布"}」的結果：
                </p>
              )}
              {publishResults.map((r) => (
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

      <Card className="opacity-70">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4" />
            <CardTitle>排程自動發文</CardTitle>
            <Badge variant="outline">Phase 2 · 尚未開放</Badge>
          </div>
          <CardDescription>
            預留區塊：之後會用 pg_cron 排程（跟 process-ended-topics-closing 同一套機制）定期呼叫 <code>action: "publish", mode: "live"</code>，不需要人工每次手動按。下面的控制項目前是停用的示意，實際邏輯還沒開發。
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 pointer-events-none select-none">
          <div className="flex items-center gap-3">
            <Switch checked={false} disabled />
            <Label>啟用排程自動發文</Label>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Label className="text-sm text-muted-foreground">發文頻率</Label>
            <Select disabled>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="每天 1 次" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="daily-1">每天 1 次</SelectItem>
                <SelectItem value="daily-3">每天 3 次</SelectItem>
                <SelectItem value="weekly-3">每週 3 次</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <p className="text-xs text-muted-foreground">
            下次排程時間：—（尚未啟用）
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>發文紀錄</CardTitle>
          <CardDescription>最近 20 筆（測試與正式，只有真的呼叫過發布 API 的才會出現在這裡）</CardDescription>
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
