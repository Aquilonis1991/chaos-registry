import { useState, useEffect, useCallback, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useSystemConfigCache } from "@/hooks/useSystemConfigCache";
import { useLanguage } from "@/contexts/LanguageContext";
import { useUIText } from "@/hooks/useUIText";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Coins, Info, Loader2, ThumbsDown, ThumbsUp } from "lucide-react";

export type ArenaMessage = {
  id: string;
  topic_id: string;
  user_id: string;
  content: string;
  ttl_minutes: number;
  shield_until: string | null;
  upvote_count: number;
  downvote_count: number;
  is_legacy: boolean;
  created_at: string;
  /** 最後一次 TTL／互動更新時間（自然衰減推算用） */
  updated_at: string;
};

export function ArenaSection({
  topicId,
  topicEndAt,
  userId,
  isTopicEnded,
}: {
  topicId: string;
  topicEndAt: string;
  userId: string | null;
  isTopicEnded: boolean;
}) {
  const { language } = useLanguage();
  const { getText } = useUIText(language);
  const { getConfig } = useSystemConfigCache();
  const [messages, setMessages] = useState<ArenaMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [inputOpen, setInputOpen] = useState(false);
  const [inputText, setInputText] = useState("");
  const [buyShield, setBuyShield] = useState(false);
  const [posting, setPosting] = useState(false);
  const [voteIds, setVoteIds] = useState<Set<string>>(new Set());
  /** 留言 user_id → profiles.nickname（暱稱，單次批次查詢） */
  const [authorNames, setAuthorNames] = useState<Record<string, string>>({});

  const x = getConfig("arena_throne_min_threshold_x", 100) as number;
  const y = getConfig("arena_elite_min_threshold_y", 50) as number;
  const maxLen = getConfig("arena_comment_max_length", 100) as number;
  const shieldPrice = getConfig("arena_shield_price", 100) as number;
  const shieldHours = Number(getConfig("arena_shield_duration_hours", 3)) || 3;
  const shieldLegacyBonus = Number(getConfig("arena_shield_legacy_bonus", 180)) || 180;
  const upBonus = getConfig("arena_upvote_time_bonus", 10) as number;
  const downPenalty = getConfig("arena_downvote_time_penalty", 12) as number;
  /** 每分鐘自然消耗分鐘數（與 decay_arena_ttl 一致；畫面即時推算，不依賴僅 cron 寫回 DB） */
  const decayRate = Number(getConfig("arena_natural_decay_rate", 1)) || 1;

  /** 定時觸發重繪，使「存在週期剩餘」隨時間遞減 */
  const [, setTtlTick] = useState(0);
  useEffect(() => {
    if (messages.length === 0) return undefined;
    const id = window.setInterval(() => setTtlTick((n) => n + 1), 10000);
    return () => window.clearInterval(id);
  }, [messages.length, topicId]);

  const fetchMessages = useCallback(
    async (opts?: { silent?: boolean }) => {
      if (!topicId) {
        setLoading(false);
        return;
      }
      if (!opts?.silent) setLoading(true);
      const { data, error } = await supabase
        .from("topic_arena_messages")
        .select("*")
        .eq("topic_id", topicId)
        .order("created_at", { ascending: true });
      if (!opts?.silent) setLoading(false);
      if (error) {
        toast.error(getText("arena.toast.loadFailed", "載入失敗"));
        return;
      }
      const rows = (data as ArenaMessage[]) || [];
      setMessages(rows);
      if (rows.length === 0) {
        setAuthorNames({});
        return;
      }
      const uids = [...new Set(rows.map((r) => r.user_id))];
      const { data: profs, error: profErr } = await supabase
        .from("profiles")
        .select("id, nickname")
        .in("id", uids);
      if (profErr) {
        console.warn("[arena] profiles batch:", profErr.message);
      }
      const next: Record<string, string> = {};
      const fallback = getText("arena.userFallback", "用戶");
      profs?.forEach((p) => {
        const row = p as { id: string; nickname: string | null };
        const n = row.nickname;
        next[row.id] = (n && String(n).trim()) || fallback;
      });
      uids.forEach((uid) => {
        if (!next[uid]) next[uid] = fallback;
      });
      setAuthorNames(next);
    },
    [topicId, getText]
  );

  const fetchMyVotes = useCallback(async () => {
    if (!userId || messages.length === 0) return;
    const ids = messages.map((m) => m.id);
    const { data } = await supabase
      .from("topic_arena_votes")
      .select("message_id")
      .eq("user_id", userId)
      .in("message_id", ids);
    setVoteIds(new Set((data || []).map((r) => String(r.message_id))));
  }, [userId, messages]);

  useEffect(() => {
    fetchMessages();
  }, [fetchMessages]);

  useEffect(() => {
    fetchMyVotes();
  }, [fetchMyVotes]);

  const handlePost = async () => {
    if (!userId) return;
    const t = (inputText || "").trim();
    if (!t) return;
    if (t.length > maxLen) {
      toast.error(getText("arena.toast.maxChars", "最多 {{max}} 字").replace("{{max}}", String(maxLen)));
      return;
    }
    setPosting(true);
    try {
      const { data, error } = await supabase.rpc("post_arena_message", {
        p_topic_id: topicId,
        p_content: t,
        p_buy_shield: buyShield,
      });
      if (error) throw error;
      setInputOpen(false);
      setInputText("");
      setBuyShield(false);
      toast.success(getText("arena.toast.postSuccess", "已發表"));
      await fetchMessages({ silent: true });
    } catch (e: unknown) {
      const raw =
        (e as { message?: string })?.message || (e as { details?: string })?.details || String(e);
      if (/One message per topic allowed/i.test(raw)) {
        toast.error(getText("arena.toast.onePerTopic", "每個主題僅限發表一則觀點"));
      } else {
        const msg = raw || getText("arena.toast.postFailed", "發表失敗");
        toast.error(msg);
      }
    } finally {
      setPosting(false);
    }
  };

  const handleVote = async (messageId: string, voteType: "upvote" | "downvote") => {
    if (!userId) {
      toast.error(getText("arena.needLoginVote", "請先登入後再互動"));
      return;
    }
    const mid = String(messageId);
    if (voteIds.has(mid)) return;
    try {
      const { error } = await supabase.rpc("cast_arena_vote", {
        p_message_id: mid,
        p_vote_type: voteType,
      });
      if (error) throw error;
      setVoteIds((s) => new Set([...s, mid]));
      await fetchMessages({ silent: true });
    } catch (e: unknown) {
      toast.error((e as { message?: string })?.message || getText("arena.toast.voteFailed", "投票失敗"));
    }
  };

  const net = (m: ArenaMessage) => m.upvote_count - m.downvote_count;
  const isShielded = (m: ArenaMessage) => m.shield_until && new Date(m.shield_until) > new Date();

  /** 畫面顯示用剩餘分鐘：依 updated_at 推算自然衰減；鎖定中與後端相同不扣時間 */
  const displayTtlMinutes = (m: ArenaMessage) => {
    const base = Math.max(0, m.ttl_minutes);
    if (isShielded(m)) return base;
    const anchor = m.updated_at || m.created_at;
    const t0 = new Date(anchor).getTime();
    if (Number.isNaN(t0)) return base;
    const elapsedMin = (Date.now() - t0) / 60000;
    return Math.max(0, Math.floor(base - decayRate * elapsedMin));
  };
  const core = messages.filter((m) => net(m) >= x).sort((a, b) => net(b) - net(a))[0];
  const elite = messages
    .filter((m) => m.id !== core?.id && net(m) >= y)
    .sort((a, b) => net(b) - net(a))
    .slice(0, 3);
  const mundane = messages.filter(
    (m) => m.id !== core?.id && !elite.some((e) => e.id === m.id)
  );

  /** 贊同／斥責：僅 icon + (±X min)，靠右下；完整說明放 aria-label */
  const renderArenaMessageBlock = (m: ArenaMessage, variant: "core" | "elite" | "card") => {
    const mid = String(m.id);
    const name =
      authorNames[m.user_id] ?? getText("arena.userFallback", "用戶");
    const ttlText = getText("arena.ttlRemaining", "存在週期剩餘: {{minutes}} 分鐘").replace(
      "{{minutes}}",
      String(displayTtlMinutes(m))
    );
    const ttlCls =
      variant === "card" ? "text-[11px] text-muted-foreground/65" : "text-[11px] text-[#A0A0A0]/75";
    const countCls =
      variant === "card" ? "text-[11px] text-muted-foreground" : "text-[11px] text-[#A0A0A0]";
    const borderCls = variant === "card" ? "border-border/40" : "border-white/10";
    const contentCls =
      variant === "card" ? "text-sm text-foreground leading-relaxed" : "text-sm text-white leading-relaxed";
    const nameCls =
      variant === "card" ? "text-sm font-medium text-foreground truncate" : "text-sm font-medium text-white truncate";
    const upAria = getText("arena.upvote", "贊同 (+{{bonus}})").replace("{{bonus}}", String(upBonus));
    const downAria = getText("arena.downvote", "斥責 (-{{penalty}})").replace("{{penalty}}", String(downPenalty));
    const btnBase =
      "inline-flex min-h-[36px] items-center justify-center gap-1 rounded-full px-2.5 py-1.5 text-xs font-semibold shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 shrink-0";
    const upBtn = cn(btnBase, "bg-[#1877F2] text-white hover:bg-[#166FE5] active:bg-[#1565D8]");
    const downBtnCard = cn(
      btnBase,
      "bg-[#E4E6EB] text-[#4B4F56] hover:bg-[#D8DADF] dark:bg-[#3A3B3C] dark:text-[#E4E6EB] dark:hover:bg-[#4E4F50]"
    );
    const downBtnArena = cn(btnBase, "bg-[#3A3B3C] text-[#E4E6EB] hover:bg-[#4E4F50] active:bg-[#3a3c41]");

    const counts = (
      <div className={cn(countCls, "inline-flex items-center gap-3")}>
        <span className="inline-flex items-center gap-1">
          <ThumbsUp className="h-3.5 w-3.5 shrink-0" strokeWidth={2.25} aria-hidden />
          <span className="tabular-nums">{m.upvote_count}</span>
        </span>
        <span className="inline-flex items-center gap-1">
          <ThumbsDown className="h-3.5 w-3.5 shrink-0" strokeWidth={2.25} aria-hidden />
          <span className="tabular-nums">{m.downvote_count}</span>
        </span>
      </div>
    );

    let footer: ReactNode;
    if (isTopicEnded) {
      footer = (
        <div className={cn("mt-3 pt-2 border-t flex items-end justify-between", borderCls)}>{counts}</div>
      );
    } else if (voteIds.has(mid)) {
      footer = (
        <div className={cn("mt-3 pt-2 border-t flex items-end justify-between gap-2", borderCls)}>
          {counts}
          <span
            className={cn(
              "text-[11px] shrink-0",
              variant === "card" ? "text-muted-foreground" : "text-[#A0A0A0]"
            )}
          >
            {getText("arena.voted", "已投票")}
          </span>
        </div>
      );
    } else {
      footer = (
        <div className={cn("mt-3 pt-2 border-t flex items-end justify-between gap-2", borderCls)}>
          {counts}
          <div className="flex shrink-0 gap-1.5 ml-auto">
            <button type="button" className={upBtn} onClick={() => void handleVote(mid, "upvote")} aria-label={upAria}>
              <ThumbsUp className="h-3.5 w-3.5 shrink-0" strokeWidth={2.25} aria-hidden />
              <span className="tabular-nums whitespace-nowrap">
                (+{upBonus} min)
              </span>
            </button>
            <button
              type="button"
              className={variant === "card" ? downBtnCard : downBtnArena}
              onClick={() => void handleVote(mid, "downvote")}
              aria-label={downAria}
            >
              <ThumbsDown className="h-3.5 w-3.5 shrink-0" strokeWidth={2.25} aria-hidden />
              <span className="tabular-nums whitespace-nowrap">
                (-{downPenalty} min)
              </span>
            </button>
          </div>
        </div>
      );
    }

    return (
      <>
        <div className="flex items-baseline justify-between gap-2 mb-2">
          <span className={nameCls}>{name}</span>
          <span className={cn(ttlCls, "shrink-0 max-w-[55%] text-right leading-tight")}>{ttlText}</span>
        </div>
        <p className={contentCls}>{m.content}</p>
        {isShielded(m) && (
          <p
            className={cn(
              "text-xs mt-2",
              variant === "card" ? "text-amber-600 dark:text-amber-500 font-medium" : "text-[#D4AF37]"
            )}
          >
            {getText("arena.shieldLocked", "[🔒數據鎖定中]")}
          </p>
        )}
        {footer}
      </>
    );
  };

  if (!topicId) return null;

  const shieldDetailText = getText(
    "arena.shieldDetailBody",
    "開啟後，發表成功時將從帳戶扣除 {{price}} 代幣，並套用以下效果：\n\n· 鎖定約 {{hours}} 小時：鎖定期間內，系統對該則留言的「存在週期自然衰減」會暫停。\n· 發表時額外增加約 {{bonus}} 分鐘的存在週期。\n\n其他使用者仍可贊同或斥責；斥責仍可能縮短剩餘存在週期（但不會低於 0）。"
  )
    .replace(/\{\{price\}\}/g, String(shieldPrice))
    .replace(/\{\{hours\}\}/g, String(shieldHours))
    .replace(/\{\{bonus\}\}/g, String(shieldLegacyBonus));

  const postDialog = !isTopicEnded && userId && (
    <>
      <Button
        variant="outline"
        size="sm"
        className="mt-3 font-mono w-full sm:w-auto"
        onClick={() => setInputOpen(true)}
        type="button"
      >
        {getText("arena.postButton", "發表觀點")}
      </Button>
      <Dialog open={inputOpen} onOpenChange={setInputOpen}>
        <DialogContent className="font-sans">
          <DialogHeader>
            <DialogTitle>{getText("arena.dialogTitle", "發表觀點")}</DialogTitle>
          </DialogHeader>
          <Textarea
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder={getText("arena.placeholderMaxChars", "最多 {{max}} 字").replace("{{max}}", String(maxLen))}
            maxLength={maxLen}
            className="font-mono min-h-[120px]"
          />
          {/* 版式參考建立主題「互動擴充設定」：Card + 左欄說明 + Switch */}
          <Card className="border border-border/60">
            <CardContent className="p-4">
              <div className="flex items-center justify-between gap-4">
                <div className="space-y-0.5 min-w-0 flex-1">
                  <Label htmlFor="arena-shield-switch" className="text-sm font-medium text-foreground cursor-pointer">
                    {getText("arena.shieldTitle", "購買數據鎖定保險")}
                  </Label>
                  <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                    <Coins className="h-4 w-4 shrink-0 opacity-80" aria-hidden />
                    <span>
                      {getText("arena.shieldCostLine", "{{price}} 代幣").replace("{{price}}", String(shieldPrice))}
                    </span>
                  </div>
                </div>
                <Switch
                  id="arena-shield-switch"
                  checked={buyShield}
                  onCheckedChange={setBuyShield}
                  className="shrink-0"
                />
              </div>
            </CardContent>
          </Card>
          {buyShield && (
            <Alert className="border-blue-200/90 bg-blue-50/90 text-foreground dark:border-blue-900/60 dark:bg-blue-950/50">
              <Info className="h-4 w-4 text-blue-600 dark:text-blue-400" aria-hidden />
              <AlertTitle className="text-foreground">
                {getText("arena.shieldDetailTitle", "鎖定保護機制說明")}
              </AlertTitle>
              <AlertDescription className="text-sm text-muted-foreground whitespace-pre-line">
                {shieldDetailText}
              </AlertDescription>
            </Alert>
          )}
          <DialogFooter className="gap-3 sm:gap-4 sm:space-x-0 flex-col-reverse sm:flex-row sm:justify-end">
            <Button variant="outline" onClick={() => setInputOpen(false)}>
              {getText("arena.cancel", "取消")}
            </Button>
            <Button onClick={handlePost} disabled={posting || !inputText.trim()}>
              {posting ? getText("arena.submitting", "發表中...") : getText("arena.submit", "發表")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );

  return (
    <section className="mb-4" aria-label="數據回收角鬥場">
      {loading ? (
        <Card className="bg-muted/50 font-sans">
          <CardContent className="p-4 flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" aria-hidden />
            <span className="sr-only">{getText("arena.loading", "載入中")}</span>
          </CardContent>
        </Card>
      ) : messages.length === 0 ? (
        <>
          <Card className="bg-muted/50 font-sans">
            <CardContent className="p-4">
              <div className="flex items-center justify-between text-sm gap-3">
                <span className="text-muted-foreground shrink-0">
                  {getText("arena.emptyRowLabel", "留言狀態")}
                </span>
                <span className="font-semibold text-foreground text-right">
                  {getText("arena.empty", "尚未有人留言")}
                </span>
              </div>
            </CardContent>
          </Card>
          {postDialog}
        </>
      ) : (
        <>
      {core && (
        <div className="border-4 border-[#D4AF37] bg-black text-white p-6 mb-4 font-mono">
          <p className="text-sm text-[#A0A0A0] mb-2">{getText("arena.coreLabel", "核心區")}</p>
          {renderArenaMessageBlock(core, "core")}
        </div>
      )}

      {elite.length > 0 && (
        <div className="space-y-2 mb-4 font-mono">
          <p className="text-xs text-[#E0E0E0] mb-2">{getText("arena.eliteLabel", "精英區")}</p>
          {elite.map((m) => (
            <div
              key={m.id}
              className="border-2 border-[#C0C0C0] bg-[#0D0D0D] text-[#E0E0E0] p-4"
            >
              {renderArenaMessageBlock(m, "elite")}
            </div>
          ))}
        </div>
      )}

      {mundane.map((m) => (
        <Card
          key={m.id}
          className={cn(
            "bg-muted/50 font-sans mb-2",
            userId === m.user_id && "border border-dashed border-primary/50"
          )}
        >
          <CardContent className="p-4">{renderArenaMessageBlock(m, "card")}</CardContent>
        </Card>
      ))}

      {postDialog}
        </>
      )}
    </section>
  );
}
