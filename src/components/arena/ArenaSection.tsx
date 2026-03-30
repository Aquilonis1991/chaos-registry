import { useState, useEffect, useCallback, useMemo, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useSystemConfigCache } from "@/hooks/useSystemConfigCache";
import { useLanguage } from "@/contexts/LanguageContext";
import { useUIText } from "@/hooks/useUIText";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { checkBannedWords, getBannedWordErrorMessage, maskMatchedKeyword } from "@/lib/bannedWords";
import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Coins, Crown, Info, Loader2, ThumbsDown, ThumbsUp } from "lucide-react";

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
  /** 後端軟回收時間；僅作者可查詢該列（RLS） */
  recycled_at?: string | null;
  recycled_body_snapshot?: string | null;
  recycled_approver_name_snapshot?: string | null;
  message_language?: string | null;
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
  const [maskOpen, setMaskOpen] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [maskKeyword, setMaskKeyword] = useState("");
  const [reviewKeyword, setReviewKeyword] = useState("");
  const [voteIds, setVoteIds] = useState<Set<string>>(new Set());
  const [showAllMessages, setShowAllMessages] = useState(false);
  /** 留言 user_id → profiles.nickname（暱稱，單次批次查詢） */
  const [authorNames, setAuthorNames] = useState<Record<string, string>>({});
  /** 回收留言 id → 最後按下斥責者暱稱 */
  const [lastDownvoterNames, setLastDownvoterNames] = useState<Record<string, string>>({});

  /** DB value 若為 null / 非數字，不可直接當門檻：`0 >= null` 在 JS 會變成 0>=0 為 true，導致淨贊同 0 仍進「精英」樣式 */
  const coerceArenaThreshold = (raw: unknown, fallback: number) => {
    const n = Math.floor(Number(raw));
    return Number.isFinite(n) && n >= 0 ? n : fallback;
  };
  const x = coerceArenaThreshold(getConfig("arena_throne_min_threshold_x", 100), 100);
  const y = coerceArenaThreshold(getConfig("arena_elite_min_threshold_y", 50), 50);
  const maxLen = getConfig("arena_comment_max_length", 100) as number;
  const shieldPrice = getConfig("arena_shield_price", 100) as number;
  const shieldHours = Number(getConfig("arena_shield_duration_hours", 3)) || 3;
  const shieldLegacyBonus = Number(getConfig("arena_shield_legacy_bonus", 180)) || 180;
  const upBonus = getConfig("arena_upvote_time_bonus", 10) as number;
  const downPenalty = getConfig("arena_downvote_time_penalty", 12) as number;
  /** 每分鐘自然消耗分鐘數（與 decay_arena_ttl 一致；畫面即時推算，不依賴僅 cron 寫回 DB） */
  const decayRate = Number(getConfig("arena_natural_decay_rate", 1)) || 1;

  /** 定時觸發重繪，使「存在週期剩餘」隨時間遞減 */
  const [ttlTick, setTtlTick] = useState(0);
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
      // 先同步後端衰減／軟回收，避免畫面已顯示 0 分鐘但列上 TTL 尚未寫回
      try {
        await (supabase as any).rpc("decay_arena_ttl", { p_minutes: opts?.silent ? 10 : 30 });
      } catch (e) {
        console.warn("[arena] decay_arena_ttl:", e);
      }
      const { data, error } = await (supabase as any)
        .from("topic_arena_messages")
        .select("id, topic_id, user_id, content, ttl_minutes, shield_until, upvote_count, downvote_count, is_legacy, created_at, updated_at, recycled_at, recycled_body_snapshot, recycled_approver_name_snapshot, message_language")
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
        setLastDownvoterNames({});
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

      const messageIds = rows.map((r) => r.id);
      const { data: votes, error: votesErr } = await (supabase as any)
        .from("topic_arena_votes")
        .select("message_id, user_id, created_at")
        .in("message_id", messageIds)
        .eq("vote_type", "downvote")
        .order("created_at", { ascending: false });
      if (votesErr) {
        console.warn("[arena] latest downvoters:", votesErr.message);
        setLastDownvoterNames({});
        return;
      }

      const latestDownvoterByMessage: Record<string, string> = {};
      for (const v of votes || []) {
        const messageId = String((v as { message_id: string }).message_id);
        if (!latestDownvoterByMessage[messageId]) {
          latestDownvoterByMessage[messageId] = String((v as { user_id: string }).user_id);
        }
      }

      const downvoterIds = [...new Set(Object.values(latestDownvoterByMessage))];
      if (downvoterIds.length === 0) {
        setLastDownvoterNames({});
        return;
      }

      const { data: downvoterProfiles, error: downvoterProfilesErr } = await supabase
        .from("profiles")
        .select("id, nickname")
        .in("id", downvoterIds);
      if (downvoterProfilesErr) {
        console.warn("[arena] downvoter profiles:", downvoterProfilesErr.message);
        setLastDownvoterNames({});
        return;
      }

      const downvoterNameById: Record<string, string> = {};
      downvoterProfiles?.forEach((p) => {
        const row = p as { id: string; nickname: string | null };
        downvoterNameById[row.id] = (row.nickname && row.nickname.trim()) || fallback;
      });

      const lastByMessageName: Record<string, string> = {};
      Object.entries(latestDownvoterByMessage).forEach(([messageId, downvoterId]) => {
        lastByMessageName[messageId] = downvoterNameById[downvoterId] || fallback;
      });
      setLastDownvoterNames(lastByMessageName);

      const snapshotTargetIds = rows
        .filter((m) => {
          const snapshotReady =
            Boolean(m.recycled_body_snapshot && String(m.recycled_body_snapshot).trim()) &&
            Boolean(m.recycled_approver_name_snapshot && String(m.recycled_approver_name_snapshot).trim());
          if (snapshotReady) return false;
          if (m.recycled_at) return true;
          if (m.shield_until && new Date(m.shield_until) > new Date()) return false;
          const base = Math.max(0, Number(m.ttl_minutes) || 0);
          const anchor = m.updated_at || m.created_at;
          const t0 = new Date(anchor).getTime();
          if (Number.isNaN(t0)) return false;
          const elapsedMin = (Date.now() - t0) / 60000;
          const effective = Math.max(0, Math.floor(base - decayRate * elapsedMin));
          return effective <= 0;
        })
        .map((m) => m.id);

      if (snapshotTargetIds.length > 0) {
        try {
          await (supabase as any).rpc("finalize_arena_recycled_snapshots", {
            p_message_ids: snapshotTargetIds,
          });
          const { data: refreshedRows } = await (supabase as any)
            .from("topic_arena_messages")
            .select("id, recycled_body_snapshot, recycled_approver_name_snapshot")
            .in("id", snapshotTargetIds);

          if (refreshedRows && Array.isArray(refreshedRows) && refreshedRows.length > 0) {
            const refreshedMap = new Map<string, { body?: string | null; approver?: string | null }>();
            refreshedRows.forEach((r) => {
              const row = r as {
                id: string;
                recycled_body_snapshot?: string | null;
                recycled_approver_name_snapshot?: string | null;
              };
              refreshedMap.set(String(row.id), {
                body: row.recycled_body_snapshot ?? null,
                approver: row.recycled_approver_name_snapshot ?? null,
              });
            });
            setMessages((prev) =>
              prev.map((m) => {
                const snap = refreshedMap.get(String(m.id));
                if (!snap) return m;
                return {
                  ...m,
                  recycled_body_snapshot: snap.body ?? m.recycled_body_snapshot ?? null,
                  recycled_approver_name_snapshot: snap.approver ?? m.recycled_approver_name_snapshot ?? null,
                };
              })
            );
          }
        } catch (snapshotError) {
          console.warn("[arena] finalize snapshot:", snapshotError);
        }
      }
    },
    [topicId, getText, decayRate]
  );

  const fetchMyVotes = useCallback(async () => {
    if (!userId || messages.length === 0) return;
    const ids = messages.map((m) => m.id);
    const { data } = await (supabase as any)
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

  useEffect(() => {
    setShowAllMessages(false);
  }, [topicId]);

  const doPost = async (content: string) => {
    if (!userId) return;
    setPosting(true);
    try {
      const { error } = await (supabase as any).rpc("post_arena_message", {
        p_topic_id: topicId,
        p_content: content,
        p_buy_shield: buyShield,
        p_language: language,
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
      } else if (/Insufficient vote participation/i.test(raw)) {
        const required = Number(getConfig("arena_mundane_access_votes", 5)) || 5;
        toast.error(
          getText(
            "arena.toast.insufficientVoteParticipation",
            "在本主題累積投票參與度需達 {{required}}（付費票加總＋免費票次）才能發表觀點"
          ).replace("{{required}}", String(required))
        );
      } else if (/Content contains banned word/i.test(raw)) {
        toast.error(getText("arena.toast.bannedWord", "留言包含禁字，請修改後再送出"));
      } else {
        const msg = raw || getText("arena.toast.postFailed", "發表失敗");
        toast.error(msg);
      }
    } finally {
      setPosting(false);
    }
  };

  const handlePost = async () => {
    if (!userId) return;
    const t = (inputText || "").trim();
    if (!t) return;
    if (t.length > maxLen) {
      toast.error(getText("arena.toast.maxChars", "最多 {{max}} 字").replace("{{max}}", String(maxLen)));
      return;
    }
    const bannedLevels = getConfig("arena_banned_check_levels", ["A", "B", "C", "D", "E"]) as string[];
    const bannedCheck = await checkBannedWords(t, bannedLevels);
    if (bannedCheck.found) {
      if (bannedCheck.action === "block") {
        toast.error(getBannedWordErrorMessage(bannedCheck), {
          description: getText("topic.banned.description", "發現禁字：{{keyword}}（級別：{{level}}）")
            .replace("{{keyword}}", bannedCheck.keyword || "")
            .replace("{{level}}", bannedCheck.level || ""),
        });
        return;
      }
      if (bannedCheck.action === "mask") {
        setMaskKeyword(bannedCheck.keyword || "");
        setMaskOpen(true);
        return;
      }
      if (bannedCheck.action === "review") {
        setReviewKeyword(bannedCheck.keyword || "");
        setReviewOpen(true);
        return;
      }
    }
    await doPost(t);
  };

  const handleVote = async (messageId: string, voteType: "upvote" | "downvote") => {
    if (!userId) {
      toast.error(getText("arena.needLoginVote", "請先登入後再互動"));
      return;
    }
    const mid = String(messageId);
    if (voteIds.has(mid)) return;
    try {
      const { error } = await (supabase as any).rpc("cast_arena_vote", {
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

  const net = (m: ArenaMessage) =>
    (Number(m.upvote_count) || 0) - (Number(m.downvote_count) || 0);
  const isShielded = (m: ArenaMessage) => Boolean(m.shield_until && new Date(m.shield_until) > new Date());
  const shieldRemainingText = (m: ArenaMessage) => {
    if (!m.shield_until) return "";
    const diffMs = new Date(m.shield_until).getTime() - Date.now();
    if (diffMs <= 0) return "";
    const totalMin = Math.max(1, Math.ceil(diffMs / 60000));
    const h = Math.floor(totalMin / 60);
    const min = totalMin % 60;
    if (h > 0) {
      return getText("arena.shieldRemainingHoursMinutes", "剩餘 {{hours}} 小時 {{minutes}} 分鐘")
        .replace("{{hours}}", String(h))
        .replace("{{minutes}}", String(min));
    }
    return getText("arena.shieldRemainingMinutes", "剩餘 {{minutes}} 分鐘")
      .replace("{{minutes}}", String(min));
  };

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

  /** 回收留言也保留在列表，改為以回收卡呈現 */
  const visibleMessages = useMemo(() => messages, [messages]);

  /** 顯示灰色回收卡（後端已回收或前端推算 TTL 已歸零） */
  const isRecycledView = (m: ArenaMessage) => {
    if (m.recycled_at) return true;
    return !isShielded(m) && displayTtlMinutes(m) <= 0;
  };

  const activeMessages = useMemo(
    () => visibleMessages.filter((m) => !isRecycledView(m)),
    [visibleMessages, ttlTick, decayRate, userId]
  );
  const core = activeMessages.filter((m) => net(m) >= x).sort((a, b) => net(b) - net(a))[0];
  const elite = useMemo(() => {
    return activeMessages
      .filter((m) => m.id !== core?.id && net(m) >= y)
      .sort((a, b) => net(b) - net(a))
      .slice(0, 3);
  }, [activeMessages, core?.id, y]);
  const eliteIdSet = useMemo(() => new Set(elite.map((m) => m.id)), [elite]);
  const nonEliteSortedByTime = useMemo(() => {
    return visibleMessages
      .filter((m) => m.id !== core?.id && !eliteIdSet.has(m.id))
      .sort((a, b) => {
        const aRecycled = isRecycledView(a);
        const bRecycled = isRecycledView(b);
        if (aRecycled !== bRecycled) return aRecycled ? 1 : -1;
        const aTime = new Date(a.updated_at || a.created_at).getTime();
        const bTime = new Date(b.updated_at || b.created_at).getTime();
        if (bTime !== aTime) return bTime - aTime;
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      });
  }, [visibleMessages, core?.id, eliteIdSet, ttlTick, decayRate, userId]);
  const collapsedNonElite = nonEliteSortedByTime.slice(0, 3);
  const displayedNonElite = showAllMessages ? nonEliteSortedByTime : collapsedNonElite;
  const hasHiddenMessages = nonEliteSortedByTime.length > collapsedNonElite.length;
  const collapsedDisplayCount = core ? 4 : 3;
  const recycledVariantCount = 20;

  const getStableRecycledVariant = useCallback((seed: string) => {
    let hash = 0;
    for (let i = 0; i < seed.length; i += 1) {
      hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
    }
    return (hash % recycledVariantCount) + 1;
  }, []);

  /** 贊同／斥責：僅 icon + (±X min)，靠右下；完整說明放 aria-label */
  const renderArenaMessageBlock = (m: ArenaMessage, variant: "core" | "elite" | "card") => {
    const formatTs = (iso?: string | null) => {
      if (!iso) return "";
      const dt = new Date(iso);
      if (Number.isNaN(dt.getTime())) return "";
      return dt.toLocaleString();
    };
    const createdAtText = formatTs(m.created_at);
    const recycledAtText = formatTs(m.recycled_at ?? null);

    if (isRecycledView(m)) {
      const author = authorNames[m.user_id] ?? getText("arena.userFallback", "用戶");
      const variant = getStableRecycledVariant(String(m.id));
      const baseTemplate = getText(
        "arena.recycledBody",
        "您的留言存在週期已歸零。系統執行回收。最終結果：👍贊同 {{up}} / 👎斥責 {{down}}，感謝您發表廢話。"
      );
      const dynamicBody = getText(`arena.recycledBody.${variant}`, baseTemplate)
        .replace("{{up}}", String(m.upvote_count))
        .replace("{{down}}", String(m.downvote_count));
      const body = (m.recycled_body_snapshot && m.recycled_body_snapshot.trim()) || dynamicBody;
      const firstLine = `${author}，${body}`;
      const approverName = (
        m.recycled_approver_name_snapshot &&
        m.recycled_approver_name_snapshot.trim()
      ) || lastDownvoterNames[String(m.id)] || getText("arena.finalApproverSystem", "系統自動回收");
      const secondLine = getText("arena.finalApproverLabel", "最終核定員：{{name}}").replace("{{name}}", approverName);
      const stampApproved = getText("arena.signatureApproved", "已核定");
      const isOwner = userId === m.user_id;
      return (
        <div
          className={cn(
            "rounded-lg border border-muted-foreground/35 bg-muted/90 px-4 py-3 text-sm text-muted-foreground leading-relaxed",
            isOwner && "border-dashed"
          )}
          role="status"
        >
          <div>{firstLine}</div>
          <div className="mt-1 flex items-center justify-between gap-3">
            <div>{secondLine}</div>
            <div
              className="shrink-0 rotate-[-10deg] rounded-md border-2 border-red-600/85 bg-red-500/10 px-2 py-1 text-red-700 dark:text-red-400"
              aria-label={`${stampApproved}：${approverName}`}
              title={`${stampApproved}：${approverName}`}
            >
              <div className="flex min-w-[72px] flex-col items-center justify-center whitespace-nowrap text-center leading-tight">
                <span className="text-[12px] font-semibold">{approverName}</span>
                <span className="mt-0.5 text-[10px] font-bold tracking-wider">{stampApproved}</span>
              </div>
            </div>
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[9px] text-muted-foreground/80">
            {createdAtText && (
              <span>
                {getText("arena.createdAtLabel", "留言時間：")}
                {createdAtText}
              </span>
            )}
            {recycledAtText && (
              <span>
                {getText("arena.recycledAtLabel", "回收時間：")}
                {recycledAtText}
              </span>
            )}
          </div>
        </div>
      );
    }

    const mid = String(m.id);
    const name =
      authorNames[m.user_id] ?? getText("arena.userFallback", "用戶");
    const ttlText = getText("arena.ttlRemaining", "存在週期剩餘: {{minutes}} 分鐘").replace(
      "{{minutes}}",
      String(displayTtlMinutes(m))
    );
    const ttlCls = "text-[11px] text-muted-foreground/75";
    const countCls = "text-[11px] text-muted-foreground";
    const borderCls = "border-border/40";
    const contentCls = "text-sm text-foreground leading-relaxed";
    const nameCls = "text-sm font-medium text-foreground truncate";
    const upAria = getText("arena.upvote", "贊同 (+{{bonus}})").replace("{{bonus}}", String(upBonus));
    const downAria = getText("arena.downvote", "斥責 (-{{penalty}})").replace("{{penalty}}", String(downPenalty));
    const btnBase =
      "inline-flex min-h-[36px] items-center justify-center gap-1 rounded-full px-2.5 py-1.5 text-xs font-semibold shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 shrink-0";
    const upBtn = cn(btnBase, "bg-[#1877F2] text-white hover:bg-[#166FE5] active:bg-[#1565D8]");
    const downBtnCard = cn(
      btnBase,
      "bg-[#E4E6EB] text-[#4B4F56] hover:bg-[#D8DADF] dark:bg-[#3A3B3C] dark:text-[#E4E6EB] dark:hover:bg-[#4E4F50]"
    );
    const downBtnArena = downBtnCard;

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
              "text-muted-foreground"
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
              "text-xs mt-2 text-right",
              "text-amber-600 dark:text-amber-500 font-medium"
            )}
          >
            {getText("arena.shieldLocked", "[🔒數據鎖定中]")}
            {` ${shieldRemainingText(m)}`}
          </p>
        )}
        {createdAtText && (
          <p className="mt-2 text-[9px] text-muted-foreground/80">
            {getText("arena.createdAtLabel", "留言時間：")}
            {createdAtText}
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
    .replace(/\{\{bonus\}\}/g, String(shieldLegacyBonus))
    // DB 文案若以字面 \n 儲存，轉成實際換行以正確顯示
    .replace(/\\n/g, "\n");

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
            <Button onClick={() => void handlePost()} disabled={posting || !inputText.trim()}>
              {posting ? getText("arena.submitting", "發表中...") : getText("arena.submit", "發表")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <AlertDialog open={maskOpen} onOpenChange={setMaskOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{getText("topic.mask.title", "內容包含敏感字詞")}</AlertDialogTitle>
            <AlertDialogDescription>
              {getText("topic.mask.description", "發現敏感字詞「{{keyword}}」，將依規則遮罩後再送出。是否確認？")
                .replace("{{keyword}}", maskKeyword)}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2 sm:gap-2">
            <AlertDialogCancel>{getText("arena.cancel", "取消")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                const masked = maskMatchedKeyword(inputText, maskKeyword);
                setInputText(masked);
                setMaskOpen(false);
              }}
            >
              {getText("topic.mask.confirm", "確認遮罩")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <AlertDialog open={reviewOpen} onOpenChange={setReviewOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{getText("topic.review.title", "內容需經審核")}</AlertDialogTitle>
            <AlertDialogDescription>
              {getText("topic.review.description", "發現需審核字詞「{{keyword}}」。仍要送出嗎？送出後將進入審核流程。")
                .replace("{{keyword}}", reviewKeyword)}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2 sm:gap-2">
            <AlertDialogCancel>{getText("arena.cancel", "取消")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setReviewOpen(false);
                void doPost(inputText.trim());
              }}
            >
              {getText("topic.review.confirm", "仍要送出")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
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
        <div
          className={cn(
            "p-6 mb-4 rounded-lg border-2 shadow-sm",
            isRecycledView(core)
              ? "border border-muted-foreground/40 bg-muted/60 text-foreground"
              : "border-amber-500/50 bg-gradient-to-br from-amber-500/15 via-yellow-500/5 to-transparent text-foreground"
          )}
        >
          {!isRecycledView(core) && <Crown className="h-4 w-4 text-amber-600 dark:text-amber-400 mb-2" aria-hidden />}
          {renderArenaMessageBlock(core, "core")}
        </div>
      )}

      {elite.length > 0 && (
        <div className="space-y-2 mb-4">
          {elite.map((m) => (
            <div
              key={m.id}
              className={cn(
                "p-4 rounded-lg border shadow-sm",
                isRecycledView(m)
                  ? "border border-muted-foreground/40 bg-muted/60 text-foreground"
                  : "border-slate-300/80 dark:border-slate-500/60 bg-gradient-to-br from-slate-100 via-zinc-100 to-slate-200 dark:from-slate-700/80 dark:via-zinc-700/70 dark:to-slate-800/70 text-foreground"
              )}
            >
              {renderArenaMessageBlock(m, "elite")}
            </div>
          ))}
        </div>
      )}

      {displayedNonElite.length > 0 && (
        <div className="space-y-2 mb-4">
          {displayedNonElite.map((m) => (
            <div
              key={m.id}
              className={cn(
                "p-4 rounded-lg border shadow-sm",
                isRecycledView(m)
                  ? "border border-muted-foreground/40 bg-muted/60 text-foreground"
                  : "border-slate-300/70 dark:border-slate-700 bg-gradient-to-br from-gray-100 to-transparent dark:from-gray-800/50 dark:to-transparent text-foreground"
              )}
            >
              {renderArenaMessageBlock(m, "card")}
            </div>
          ))}
        </div>
      )}

      {(hasHiddenMessages || showAllMessages) && (
        <div className="mb-2 flex justify-center">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setShowAllMessages((v) => !v)}
          >
            {showAllMessages
              ? getText("arena.collapseMessages", "收合留言")
              : getText("arena.expandMessages", "展開全部留言")}
          </Button>
        </div>
      )}

      {postDialog}
        </>
      )}
    </section>
  );
}
