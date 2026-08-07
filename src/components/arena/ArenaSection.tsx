import { useState, type ReactNode } from "react";
import { useSystemConfigCache } from "@/hooks/useSystemConfigCache";
import { useLanguage } from "@/contexts/LanguageContext";
import { useUIText } from "@/hooks/useUIText";
import { useServerTime } from "@/contexts/ServerTimeContext";
import { useArenaBoard } from "@/hooks/useArenaBoard";
import { useModerationGate } from "@/hooks/useModerationGate";
import { getStableRecycledVariant } from "@/lib/arena/arenaRanking";
import type { ArenaMessage } from "@/lib/arena/types";
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
import { checkBannedWords, getBannedWordErrorMessage } from "@/lib/bannedWords";
import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Coins, Crown, Info, Loader2, ThumbsDown, ThumbsUp } from "lucide-react";

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
  const { getNowMs } = useServerTime();
  const [inputOpen, setInputOpen] = useState(false);
  const [inputText, setInputText] = useState("");
  const [buyShield, setBuyShield] = useState(false);
  const moderation = useModerationGate();
  const [showAllMessages, setShowAllMessages] = useState(false);

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

  const fallbackAuthorName = getText("arena.userFallback", "用戶");
  const {
    messages,
    loading,
    posting,
    voteIds,
    authorNames,
    lastDownvoterNames,
    core,
    elite,
    nonEliteSortedByTime,
    isRecycledView,
    isShielded,
    displayTtlMinutes,
    vote,
    post,
  } = useArenaBoard({
    topicId,
    userId,
    fallbackAuthorName,
    coreThreshold: x,
    eliteThreshold: y,
    decayRate,
  });

  const collapsedNonElite = nonEliteSortedByTime.slice(0, 3);
  const displayedNonElite = showAllMessages ? nonEliteSortedByTime : collapsedNonElite;
  const hasHiddenMessages = nonEliteSortedByTime.length > collapsedNonElite.length;

  const submitPost = async (content: string) => {
    if (!userId) return;
    const result = await post(content, { buyShield, language });
    // 注意：本專案 tsconfig 關閉了 strictNullChecks，`if (result.ok)` 無法可靠縮窄聯合型別；
    // 改用 `"error" in result` 這種 in 運算子縮窄，才能讓 TypeScript 正確推導出錯誤分支的型別。
    if ("error" in result) {
      switch (result.error.code) {
        case "one_message_per_topic":
          toast.error(getText("arena.toast.onePerTopic", "每個主題僅限發表一則觀點"));
          break;
        case "insufficient_vote_participation": {
          const required = Number(getConfig("arena_mundane_access_votes", 5)) || 5;
          toast.error(
            getText(
              "arena.toast.insufficientVoteParticipation",
              "在本主題累積投票參與度需達 {{required}}（付費票加總＋免費票次）才能發表觀點"
            ).replace("{{required}}", String(required))
          );
          break;
        }
        case "banned_word":
          toast.error(getText("arena.toast.bannedWord", "留言包含禁字，請修改後再送出"));
          break;
        default:
          toast.error(result.error.raw || getText("arena.toast.postFailed", "發表失敗"));
      }
      return;
    }
    setInputOpen(false);
    setInputText("");
    setBuyShield(false);
    toast.success(getText("arena.toast.postSuccess", "已發表"));
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
    const decision = moderation.evaluate(bannedCheck);
    if (decision === "block") {
      toast.error(getBannedWordErrorMessage(bannedCheck), {
        description: getText("topic.banned.description", "發現禁字：{{keyword}}（級別：{{level}}）")
          .replace("{{keyword}}", bannedCheck.keyword || "")
          .replace("{{level}}", bannedCheck.level || ""),
      });
      return;
    }
    if (decision !== "pass") return; // mask/review 彈窗已開，等使用者操作
    await submitPost(t);
  };

  const handleVote = async (messageId: string, voteType: "upvote" | "downvote") => {
    const result = await vote(messageId, voteType);
    if (!("reason" in result) || result.reason === "duplicate") return;
    if (result.reason === "not_logged_in") {
      toast.error(getText("arena.needLoginVote", "請先登入後再互動"));
      return;
    }
    toast.error(result.message || getText("arena.toast.voteFailed", "投票失敗"));
  };

  const shieldRemainingText = (m: ArenaMessage) => {
    if (!m.shield_until) return "";
    const diffMs = new Date(m.shield_until).getTime() - getNowMs();
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
      ) || lastDownvoterNames[String(m.id)] || getText("arena.signature.approverNone", "系統自動回收");
      const secondLine = getText("arena.signature.approver", "最終核定員：{{name}}").replace("{{name}}", approverName);
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
          {isOwner && (
            <div className="mt-2 text-foreground/70 italic break-words whitespace-pre-wrap line-through" title={getText('arena.recycled.originalContent', '您原本發表的內容')}>
              {m.content}
            </div>
          )}
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
      <AlertDialog open={moderation.maskState.open} onOpenChange={(open) => !open && moderation.closeMask()}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{getText("topic.mask.title", "內容包含敏感字詞")}</AlertDialogTitle>
            <AlertDialogDescription>
              {getText("topic.mask.description", "發現敏感字詞「{{keyword}}」，將依規則遮罩後再送出。是否確認？")
                .replace("{{keyword}}", moderation.maskState.keyword)}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2 sm:gap-2">
            <AlertDialogCancel>{getText("arena.cancel", "取消")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                const masked = moderation.applyMask(inputText);
                setInputText(masked);
                moderation.closeMask();
              }}
            >
              {getText("topic.mask.confirm", "確認遮罩")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <AlertDialog open={moderation.reviewState.open} onOpenChange={(open) => !open && moderation.closeReview()}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{getText("topic.review.title", "內容需經審核")}</AlertDialogTitle>
            <AlertDialogDescription>
              {getText("topic.review.description", "發現需審核字詞「{{keyword}}」。仍要送出嗎？送出後將進入審核流程。")
                .replace("{{keyword}}", moderation.reviewState.keyword)}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2 sm:gap-2">
            <AlertDialogCancel>{getText("arena.cancel", "取消")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                moderation.closeReview();
                void submitPost(inputText.trim());
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
