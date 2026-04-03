import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
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
import { ArrowLeft, User, Clock, Coins, Loader2, Gift, Flag, Sparkles, Share2 } from "lucide-react";
import { toast } from "sonner";
import { useProfile } from "@/hooks/useProfile";
import { useVoteOperations } from "@/hooks/useVoteOperations";
import { useAuth } from "@/hooks/useAuth";
import { voteSchema } from "@/lib/validationSchemas";
import { ReportDialog } from "@/components/ReportDialog";
import { useTopicDetail } from "@/hooks/useTopicDetail";
import { format } from "date-fns";
import { zhTW } from "date-fns/locale";
import { EditTopicDialog } from "@/components/EditTopicDialog";
import { DeleteTopicDialog } from "@/components/DeleteTopicDialog";
import { ExposureApplyDialog } from "@/components/ExposureApplyDialog";
import { useUserStats } from "@/hooks/useUserStats";
import { useLanguage, resolveBaseLanguage } from "@/contexts/LanguageContext";
import { detectLanguageFromText } from "@/lib/detectLanguageFromText";
import { useUIText } from "@/hooks/useUIText";
import { useSystemConfigCache } from "@/hooks/useSystemConfigCache";
import { formatRelativeTime, formatRemainingTime } from "@/lib/relativeTime";
import { cn } from "@/lib/utils";
import { ChaosClosingCard } from "@/components/ChaosClosingCard";
import { useAiClosingStatement } from "@/hooks/useAiClosingStatement";
import { isPromptConfigError, getPromptConfigKeyFromError } from "@/lib/promptConfigError";
import { PromptNotConfiguredDialog } from "@/components/PromptNotConfiguredDialog";
import { supabase } from "@/integrations/supabase/client";
import { ArenaSection } from "@/components/arena/ArenaSection";
import { useServerTime } from "@/contexts/ServerTimeContext";
import { TopicShareDialog } from "@/components/TopicShareDialog";

const VoteDetailPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { profile, loading: profileLoading, refreshProfile } = useProfile();
  const { user, isAnonymous } = useAuth();
  const { castVote, castFreeVote, checkFreeVoteAvailable } = useVoteOperations();
  const { getNow, getNowMs } = useServerTime();
  const { topic, closingInitial, loading: topicLoading, summaryClosingLoading, refreshTopic } = useTopicDetail(id);
  const { refreshStats } = useUserStats(user?.id);
  const { language } = useLanguage();
  const { getText, isLoading: uiTextsLoading } = useUIText(language);
  const { getConfig } = useSystemConfigCache();
  const voteButtonAmounts = getConfig('vote_button_amounts', [1, 10, 100]) as number[];

  const closingDisplayLang = topic?.title ? detectLanguageFromText(topic.title) : resolveBaseLanguage(language);
  const { statement: aiClosing, isLoading: aiClosingLoading, isGenerating: aiClosingGenerating, hasFetched: aiClosingHasFetched, triggerGenerate: triggerAiClosing } = useAiClosingStatement(topic, closingDisplayLang, closingInitial, summaryClosingLoading);
  const [promptConfigDialogOpen, setPromptConfigDialogOpen] = useState(false);
  const [promptConfigKey, setPromptConfigKey] = useState<string | null>(null);
  const isTopicEnded = topic
    ? topic.status === "ended" || new Date(topic.end_at || 0) <= getNow()
    : false;
  /** 已自動觸發過產生結語的 topic id 集合（避免重複呼叫） */
  const autoClosingTriggeredRef = useRef<Set<string>>(new Set());

  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [isVoting, setIsVoting] = useState(false);
  const [freeVoteAvailable, setFreeVoteAvailable] = useState(false);
  const [checkingFreeVote, setCheckingFreeVote] = useState(false);
  const [customAmount, setCustomAmount] = useState<string>("");
  const [exposureDialogOpen, setExposureDialogOpen] = useState(false);
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [shareDialogOpen, setShareDialogOpen] = useState(false);

  // 參與者付費影響主題（延長時間 / 新增選項）
  const [extendDialogOpen, setExtendDialogOpen] = useState(false);
  const [addOptionDialogOpen, setAddOptionDialogOpen] = useState(false);
  const [influenceLoading, setInfluenceLoading] = useState(false);
  const [influenceQuote, setInfluenceQuote] = useState<any>(null);
  const [extendDays, setExtendDays] = useState<1 | 2 | 3>(1);
  const [extendConfirmOpen, setExtendConfirmOpen] = useState(false);
  const [newOptionText, setNewOptionText] = useState<string>("");
  const [addOptionConfirmOpen, setAddOptionConfirmOpen] = useState(false);
  const canAddOption = topic?.allow_option_addition === true && !isTopicEnded;
  const canExtendTime = topic?.allow_time_extension === true && !isTopicEnded;

  const loadInfluenceQuote = useCallback(async () => {
    if (!topic?.id) return;
    try {
      setInfluenceLoading(true);
      const { data, error } = await (supabase.rpc as any)("get_topic_influence_quote", { p_topic_id: topic.id });
      if (error) throw error;
      setInfluenceQuote(data ?? null);
    } catch (e: any) {
      console.warn("[Influence] load quote failed:", e?.message || e);
      setInfluenceQuote(null);
    } finally {
      setInfluenceLoading(false);
    }
  }, [topic?.id]);

  useEffect(() => {
    if (extendDialogOpen || addOptionDialogOpen) {
      void loadInfluenceQuote();
    }
  }, [extendDialogOpen, addOptionDialogOpen, loadInfluenceQuote]);
  const [pendingVoteAmount, setPendingVoteAmount] = useState<number | null>(null);
  const [pendingVoteSource, setPendingVoteSource] = useState<'quick' | 'custom' | null>(null);

  const selectOptionText = getText('vote.detail.error.selectOption', '請先選擇一個選項');
  const loginRequiredTitle = getText('vote.detail.error.loginRequired.title', '需要註冊才能投票');
  const loginRequiredDescription = getText('vote.detail.error.loginRequired.description', '請先註冊帳號以參與投票');
  const needLoginText = getText('vote.detail.error.requireLogin', '請先登入');
  const insufficientTokensText = getText('vote.detail.error.insufficientTokens', '失序值不足！');
  const invalidDataText = getText('vote.detail.error.invalidData', '投票資料無效');
  const voteSuccessTemplate = getText('vote.detail.toast.voteSuccess', '成功投票 {{amount}} 失序值！');
  const voteRecordedDescription = getText('vote.detail.toast.voteSuccessDesc', '你的選擇已記錄');
  const freeVoteSuccessTitle = getText('vote.detail.toast.freeVoteSuccess', '免費票投票成功！');
  const freeVoteSuccessDescription = getText('vote.detail.toast.freeVoteSuccessDesc', '你的選擇已記錄');
  const headerTitle = getText('vote.detail.header.title', '投票詳情');
  const topicNotFoundTitle = getText('vote.detail.empty.title', '主題不存在');
  const topicNotFoundDescription = getText('vote.detail.empty.description', '找不到此投票主題');
  const backHomeButton = getText('vote.detail.empty.backHome', '返回首頁');
  const chooseAnswerTitle = isTopicEnded
    ? getText('vote.detail.section.ended', '投票已結束')
    : getText('vote.detail.section.answers', '選擇你的答案');
  const noOptionsText = getText('vote.detail.options.empty', '此主題暫無選項');
  const selectedMark = getText('vote.detail.option.selected', '✓ 已選擇');
  const unknownOptionText = getText('vote.detail.option.unknown', '未知選項');
  const anonymousCardDescription = getText('vote.detail.anonymous.description', '匿名瀏覽模式下無法投票，請註冊帳號以參與投票活動');
  const anonymousButton = getText('vote.detail.anonymous.button', '前往註冊');
  const freeVoteButtonText = getText('vote.detail.freeVote.button', '免費投票');
  const freeVoteNote = getText('vote.detail.freeVote.note', '每日每主題可免費投票一次');
  const tokenSectionTitle = getText('vote.detail.section.tokens', '投入失序值');
  const customTitle = getText('vote.detail.custom.title', '自訂票數');
  const customPlaceholder = getText('vote.detail.custom.placeholder', '輸入票數（1-1000）');
  const customErrorInvalid = getText('vote.detail.custom.error.invalid', '請輸入有效的票數（至少 1）');
  const customErrorMax = getText('vote.detail.custom.error.max', '單次投票最多 1000 票');
  const customButtonText = getText('vote.detail.custom.button', '投票');
  const balanceTemplate = getText('vote.detail.custom.balance', '當前持有：{{amount}} 失序值');
  const deadlineLabel = getText('vote.detail.info.deadline', '投票截止時間');
  const reportButtonText = getText('vote.detail.report.button', '檢舉');
  const upgradeExposureText = getText('vote.detail.exposure.upgrade', '升級曝光');
  const confirmDialogTitle = getText('vote.detail.confirm.title', '確認投入失序值');
  const confirmDialogDescriptionTemplate = getText('vote.detail.confirm.description', '確定要投入 {{amount}} 失序值給此選項？此操作會立即扣除失序值。');
  const confirmDialogCancelText = getText('vote.detail.confirm.cancel', '取消');
  const confirmDialogConfirmText = getText('vote.detail.confirm.confirm', '確認投入');

  /** PostgREST：message 常為泛用句，實際錯在 details / code；偶有 error 字串欄位 */
  const normalizeRpcError = useCallback((e: unknown): string => {
    if (e == null) return "";
    if (typeof e === "string") return e.trim();
    if (typeof e === "object" && e !== null) {
      const o = e as Record<string, unknown>;
      const code = typeof o.code === "string" && o.code.trim() ? `[${o.code}]` : "";
      const msg = typeof o.message === "string" ? o.message : "";
      const det = typeof o.details === "string" ? o.details : "";
      const hint = typeof o.hint === "string" ? o.hint : "";
      const err = typeof o.error === "string" ? o.error : "";
      const combined = [code, msg, det, hint, err]
        .filter((s) => s && String(s).trim())
        .join(" ")
        .trim();
      if (combined) return combined;
      try {
        const j = JSON.stringify(o);
        if (j && j !== "{}" && j.length < 1500) return j;
      } catch {
        /* ignore */
      }
    }
    if (e instanceof Error) return e.message || "";
    return String(e);
  }, []);

  const getInfluenceErrorText = useCallback((raw?: string) => {
    const fallback = getText("topic.influence.actionFailed", "操作失敗");
    const message = String(raw || "").trim();
    if (!message) return fallback;

    if (/Rate limit exceeded|Try again later/i.test(message)) {
      return getText("topic.influence.error.rateLimit", "請求過於頻繁，請稍後再試");
    }
    if (/violates check constraint|token_transactions_transaction_type_check/i.test(message)) {
      return getText("topic.influence.error.dbConstraint", "資料庫交易類型設定不完整，請聯絡管理員或確認已套用最新遷移");
    }
    if (/does not exist|relation .* not found/i.test(message)) {
      return getText("topic.influence.error.dbMissingRelation", "資料庫缺少必要資料表或函式，請確認已執行遷移");
    }

    if (/Not authenticated/i.test(message)) {
      return getText("topic.influence.error.notAuthenticated", "請先登入");
    }
    if (/Invalid days/i.test(message)) {
      return getText("topic.influence.error.invalidDays", "延長天數無效");
    }
    if (/Topic not found/i.test(message)) {
      return getText("topic.influence.error.topicNotFound", "找不到主題");
    }
    if (/Topic has ended/i.test(message)) {
      return getText("topic.influence.error.topicEnded", "主題已結束");
    }
    if (/Time extension is not allowed for this topic/i.test(message)) {
      return getText("topic.influence.error.extensionNotAllowed", "此主題不允許延長時間");
    }
    if (/Days exceed max per action/i.test(message)) {
      return getText("topic.influence.error.daysExceedMaxPerAction", "超過單次可延長上限");
    }
    if (/Not in extension window/i.test(message)) {
      return getText("topic.influence.error.notInExtensionWindow", "尚未到可延長時段");
    }
    if (/Extension limit reached/i.test(message)) {
      return getText("topic.influence.error.extensionLimitReached", "延長次數已達上限");
    }
    if (/User has already extended this topic/i.test(message)) {
      return getText("topic.influence.error.userAlreadyExtended", "你已延長過此主題");
    }
    if (/Cost config missing or invalid/i.test(message)) {
      return getText("topic.influence.error.costConfigInvalid", "成本設定錯誤，請稍後再試");
    }
    if (/User profile not found/i.test(message)) {
      return getText("topic.influence.error.profileNotFound", "找不到使用者資料");
    }
    if (/Insufficient tokens/i.test(message)) {
      return getText("topic.influence.error.insufficientTokens", "代幣不足");
    }
    if (/Option text is empty/i.test(message)) {
      return getText("topic.influence.error.optionTextEmpty", "請輸入選項內容");
    }
    if (/Option addition is not allowed for this topic/i.test(message)) {
      return getText("topic.influence.error.optionAdditionNotAllowed", "此主題不允許新增選項");
    }
    if (/Option length out of range/i.test(message)) {
      return getText("topic.influence.error.optionLengthOutOfRange", "選項長度超出限制");
    }
    if (/Option count limit reached/i.test(message)) {
      return getText("topic.influence.error.optionCountLimitReached", "選項數量已達上限");
    }
    if (/Duplicate option/i.test(message)) {
      return getText("topic.influence.error.duplicateOption", "此選項已存在");
    }
    if (/User option add limit reached/i.test(message)) {
      return getText("topic.influence.error.userOptionAddLimitReached", "你新增選項的次數已達上限");
    }

    return message.length > 0 && message.length < 300
      ? `${fallback}（${message}）`
      : fallback;
  }, [getText]);

  // Check free vote availability when component mounts（僅依賴 user/id，避免 checkFreeVote 引用變動導致 effect 重複執行、一直顯示讀取中）
  useEffect(() => {
    if (!user || isAnonymous || !id) {
      setFreeVoteAvailable(false);
      setCheckingFreeVote(false);
      return;
    }
    let cancelled = false;
    setCheckingFreeVote(true);
    const FREE_VOTE_CHECK_TIMEOUT_MS = 8000;
    const timeoutPromise = new Promise<boolean>((_, reject) =>
      setTimeout(() => reject(new Error('timeout')), FREE_VOTE_CHECK_TIMEOUT_MS)
    );
    Promise.race([checkFreeVoteAvailable(id), timeoutPromise])
      .then((available) => {
        if (!cancelled) setFreeVoteAvailable(available);
      })
      .catch((error) => {
        console.error('Error checking free vote:', error);
        if (!cancelled) setFreeVoteAvailable(false);
      })
      .finally(() => {
        if (!cancelled) setCheckingFreeVote(false);
      });
    return () => { cancelled = true; };
  }, [user?.id, isAnonymous, id]);

  // 已結束且「已取回結語狀態」後，若確定尚無結語才自動觸發產生（已產生結語的主題不再跑產生流程）。僅在實際新產生時才顯示 toast
  useEffect(() => {
    if (!topic?.id || !isTopicEnded || !aiClosingHasFetched || aiClosing || aiClosingLoading || aiClosingGenerating) return;
    if (!user || isAnonymous) return;
    if (autoClosingTriggeredRef.current.has(topic.id)) return;
    autoClosingTriggeredRef.current.add(topic.id);
    triggerAiClosing().then((r) => {
      if (r.success && r.generated) toast.success(getText("chaos_closing.generateSuccess", "結語已產生"));
      else if (r.error && isPromptConfigError(r.error)) {
        const key = getPromptConfigKeyFromError(r.error);
        if (key) {
          setPromptConfigKey(key);
          setPromptConfigDialogOpen(true);
        }
      }
    });
  }, [topic?.id, isTopicEnded, aiClosingHasFetched, aiClosing, aiClosingLoading, aiClosingGenerating, user, isAnonymous, triggerAiClosing, getText]);

  const handleVote = async (tokenAmount: number) => {
    if (!selectedOption) {
      toast.error(selectOptionText);
      return;
    }

    // Check if user is anonymous
    if (isAnonymous || !user) {
      toast.error(loginRequiredTitle, {
        description: loginRequiredDescription
      });
      navigate("/auth");
      return;
    }

    if (!profile) {
      toast.error(needLoginText);
      return;
    }

    if (profile.tokens < tokenAmount) {
      toast.error(insufficientTokensText);
      return;
    }

    // Validate with Zod
    try {
      voteSchema.parse({
        topic_id: id,
        option: selectedOption,
        amount: tokenAmount
      });
    } catch (error: any) {
      toast.error(error.errors?.[0]?.message || invalidDataText);
      return;
    }

    setIsVoting(true);
    try {
      await castVote(id!, selectedOption, tokenAmount);
      const voteSuccessTitle = voteSuccessTemplate.replace('{{amount}}', tokenAmount.toLocaleString());
      toast.success(voteSuccessTitle, {
        description: voteRecordedDescription
      });
      // 刷新主題資料以顯示最新投票結果
      refreshTopic();
      // 刷新任務統計
      refreshStats();
      // 確保代幣數量立即刷新（實時訂閱會自動更新，但這裡確保立即刷新）
      void refreshProfile();
    } catch (error) {
      // Error handled in useVoteOperations
    } finally {
      setIsVoting(false);
    }
  };

  const openVoteConfirmDialog = (amount: number, source: 'quick' | 'custom') => {
    if (!selectedOption) {
      toast.error(selectOptionText);
      return;
    }
    setPendingVoteAmount(amount);
    setPendingVoteSource(source);
    setConfirmDialogOpen(true);
  };

  const handleConfirmVote = async () => {
    if (!pendingVoteAmount) return;
    const amount = pendingVoteAmount;
    const source = pendingVoteSource;
    setConfirmDialogOpen(false);
    setPendingVoteAmount(null);
    setPendingVoteSource(null);
    if (source === 'custom') {
      setCustomAmount("");
    }
    await handleVote(amount);
  };

  const handleCancelVote = () => {
    setConfirmDialogOpen(false);
    setPendingVoteAmount(null);
    setPendingVoteSource(null);
  };

  const handleFreeVote = async () => {
    if (!selectedOption) {
      toast.error(selectOptionText);
      return;
    }

    // Check if user is anonymous
    if (isAnonymous || !user) {
      toast.error(loginRequiredTitle, {
        description: loginRequiredDescription
      });
      navigate("/auth");
      return;
    }

    setIsVoting(true);
    try {
      await castFreeVote(id!, selectedOption);
      toast.success(freeVoteSuccessTitle, {
        description: freeVoteSuccessDescription
      });
      setFreeVoteAvailable(false); // Update UI state
      // 刷新主題資料以顯示最新投票結果
      refreshTopic();
      // 刷新任務統計
      refreshStats();
    } catch (error) {
      // Error handled in useVoteOperations
    } finally {
      setIsVoting(false);
    }
  };

  const userTokens = profile?.tokens || 0;
  const waitingForTopic = !topic && (topicLoading || profileLoading || uiTextsLoading);

  // 等待主題資料時：只顯示頁面骨架（Header），內容區留白，不顯示任何讀取動畫/彈窗
  if (waitingForTopic) {
    return (
      <div className="min-h-screen bg-background pb-[calc(1.5rem+env(safe-area-inset-bottom,0px))]">
        <header className="sticky top-0 z-40 bg-gradient-primary shadow-lg pt-[calc(0.75rem+env(safe-area-inset-top,0px))]">
          <div className="max-w-screen-xl mx-auto px-5 sm:px-6 py-4">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => navigate(-1)}
                className="text-primary-foreground hover:bg-primary-foreground/20"
              >
                <ArrowLeft className="w-6 h-6" />
              </Button>
              <div className="flex-1">
                <h1 className="text-lg font-bold text-primary-foreground">{headerTitle}</h1>
              </div>
              {!isAnonymous && (
                <div className="flex items-center gap-2 bg-primary-foreground/20 backdrop-blur-sm px-3 py-1.5 rounded-full">
                  <Coins className="w-4 h-4 text-accent" />
                  <span className="font-bold text-primary-foreground text-sm">{userTokens.toLocaleString()}</span>
                </div>
              )}
            </div>
          </div>
        </header>
        <div className="max-w-screen-xl mx-auto px-5 sm:px-6 py-6" aria-busy="true" />
      </div>
    );
  }

  if (!topic) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Card className="max-w-md">
          <CardContent className="p-8 text-center">
            <h2 className="text-xl font-bold mb-2">{topicNotFoundTitle}</h2>
            <p className="text-muted-foreground mb-4">{topicNotFoundDescription}</p>
            <Button onClick={() => navigate('/home')}>{backHomeButton}</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const totalVotes = topic.total_votes || 0;
  const nowMs = getNowMs();
  const createdAtLabel = formatRelativeTime(new Date(topic.created_at), getText, nowMs);
  const remainingTimeLabel = formatRemainingTime(new Date(topic.end_at), getText, nowMs);
  const isCreator = Boolean(user && topic.creator_id === user.id);

  return (
    <>
      <div className="min-h-screen bg-background pb-[calc(1.5rem+env(safe-area-inset-bottom,0px))]">
        {/* Header：進入詳情即顯示，不擋全螢幕 */}
        <header className="sticky top-0 z-40 bg-gradient-primary shadow-lg pt-[calc(0.75rem+env(safe-area-inset-top,0px))]">
          <div className="max-w-screen-xl mx-auto px-5 sm:px-6 py-4">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => navigate(-1)}
                className="text-primary-foreground hover:bg-primary-foreground/20"
              >
                <ArrowLeft className="w-6 h-6" />
              </Button>

              <div className="flex-1">
                <h1 className="text-lg font-bold text-primary-foreground">{headerTitle}</h1>
              </div>

              {!isAnonymous && (
                <div className="flex items-center gap-2 bg-primary-foreground/20 backdrop-blur-sm px-3 py-1.5 rounded-full">
                  <Coins className="w-4 h-4 text-accent" />
                  <span className="font-bold text-primary-foreground text-sm">{userTokens.toLocaleString()}</span>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Content */}
        <div className="max-w-screen-xl mx-auto px-5 sm:px-6 py-6">
          {/* Topic Info */}
          <div className="mb-6 max-w-4xl mx-auto w-full px-4 sm:px-6">
            <div className="flex items-start justify-between gap-3 mb-3">
              <h2 className="text-2xl font-bold text-foreground flex-1 min-w-0 pr-2">
                {topic.title}
              </h2>
              <div className="flex shrink-0 gap-1.5 md:gap-2 items-center">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="shrink-0 h-10 w-10 text-[#FF4D94] hover:text-[#FF4D94] hover:bg-[#FF4D94]/15"
                  aria-label={getText("topic.share.button.aria", "分享主題")}
                  onClick={() => setShareDialogOpen(true)}
                >
                  <Share2 className="h-5 w-5" strokeWidth={2.25} aria-hidden />
                </Button>
              </div>
            </div>
            {topic && (
              <TopicShareDialog
                open={shareDialogOpen}
                onOpenChange={setShareDialogOpen}
                topicId={topic.id}
                topicTitle={topic.title}
              />
            )}

            <div className="flex flex-wrap gap-2 mb-4">
              {topic.tags.map((tag) => (
                <Badge key={tag} variant="secondary">
                  #{tag}
                </Badge>
              ))}
            </div>

            {topic.description && (
              <p className="text-base leading-relaxed text-foreground/95 mb-5">
                {topic.description}
              </p>
            )}

            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div
                className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-muted-foreground/65"
                aria-label={getText("vote.detail.meta.ariaLabel", "主題發起與時間資訊")}
              >
                <div className="flex items-center gap-1.5 min-w-0">
                  <User className="w-3.5 h-3.5 shrink-0 opacity-60" aria-hidden />
                  <span className="truncate">{topic.creator_name}</span>
                </div>
                <div className="flex items-center gap-1.5 min-w-0">
                  <Clock className="w-3.5 h-3.5 shrink-0 opacity-60" aria-hidden />
                  <span>{createdAtLabel}</span>
                </div>
                <div className="flex items-center gap-1.5 min-w-0">
                  <Clock className="w-3.5 h-3.5 shrink-0 opacity-60" aria-hidden />
                  <span>{remainingTimeLabel}</span>
                </div>
                <ReportDialog
                  targetType="topic"
                  targetId={id || ""}
                  targetTitle={topic.title}
                  trigger={
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 shrink-0 text-destructive/70 hover:text-destructive hover:bg-destructive/15"
                      aria-label={reportButtonText}
                    >
                      <Flag className="h-4 w-4" strokeWidth={2.25} aria-hidden />
                    </Button>
                  }
                />
              </div>

              {/* 編輯／刪除／曝光（僅創建者） */}
              {isCreator && (
                <div className="w-full lg:max-w-md">
                  <div className="grid gap-3 grid-cols-2 sm:grid-cols-3">
                    <div className="w-full">
                      <EditTopicDialog
                        topicId={id || ''}
                        currentTitle={topic.title}
                        currentDescription={topic.description}
                        currentOptions={topic.options.map(opt => opt.text)}
                        createdAt={topic.created_at}
                        onEditSuccess={refreshTopic}
                        triggerClassName="w-full"
                      />
                    </div>
                    <div className="w-full">
                      <DeleteTopicDialog
                        topicId={id || ''}
                        topicTitle={topic.title}
                        navigateAfterDelete={true}
                        triggerClassName="w-full"
                      />
                    </div>
                    {topic.exposure_level !== 'high' && (
                      <div className="w-full">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setExposureDialogOpen(true)}
                          className="w-full text-primary hover:text-primary"
                        >
                          <Sparkles className="w-4 h-4 mr-2" />
                          {upgradeExposureText}
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* 曝光升級對話框 */}
            {user && topic.creator_id === user.id && topic.exposure_level !== 'high' && (
              <ExposureApplyDialog
                open={exposureDialogOpen}
                onOpenChange={setExposureDialogOpen}
                topicId={id || ''}
                topicVotes={topic.total_votes || 0}
                currentLevel={(topic.exposure_level as 'normal' | 'medium' | 'high') || 'normal'}
                onSuccess={() => {
                  refreshTopic();
                }}
              />
            )}
          </div>
        </div>

        {/* Vote Options（z-0 確保在按鈕區下方；已結束時縮小與總結區間距，避免上方白塊） */}
        <div className={`relative z-0 space-y-3 max-w-3xl mx-auto w-full px-4 sm:px-6 ${isTopicEnded ? 'mb-4' : 'mb-6'}`}>
          <div className="flex items-center justify-between gap-3 mb-3">
            <h3 className="text-lg font-semibold text-foreground">{chooseAnswerTitle}</h3>
            {canAddOption && (
              <Button
                variant="outline"
                size="sm"
                className="shrink-0"
                disabled={!user || isAnonymous || isTopicEnded}
                onClick={() => setAddOptionDialogOpen(true)}
              >
                {getText("topic.influence.addOption", "新增選項")}
              </Button>
            )}
          </div>
          {topic.options && topic.options.length > 0 ? (
            topic.options.map((option, index) => {
              const optionId = (option != null && typeof option === 'object' && (option.id !== undefined && option.id !== null))
                ? String(option.id)
                : `option-${index}`;
              const optionText = option?.text || (typeof option === 'string' ? option : unknownOptionText);
              const percentage = totalVotes > 0 ? ((option?.votes || 0) / totalVotes) * 100 : 0;
              const isSelected = selectedOption === optionId;

              return (
                <Card
                  key={optionId}
                  role="button"
                  tabIndex={0}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setSelectedOption(optionId);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      setSelectedOption(optionId);
                    }
                  }}
                  className={`cursor-pointer transition-all select-none focus:outline-none hover:bg-muted/50 ${isSelected ? "border-2 border-primary bg-primary/10 shadow-md" : "hover:bg-muted/50 border border-border"
                    }`}
                >
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-semibold text-foreground">{optionText}</span>
                      <span className="text-primary font-bold">{(option?.votes || 0).toLocaleString()}</span>
                    </div>

                    <Progress value={percentage} className="h-2 mb-1" />

                    <div className="text-sm text-muted-foreground">
                      {percentage.toFixed(1)}%
                    </div>
                    {isSelected && (
                      <div className="text-xs text-primary font-medium mt-2">{selectedMark}</div>
                    )}
                  </CardContent>
                </Card>
              );
            })
          ) : (
            <Card>
              <CardContent className="p-4 text-center text-muted-foreground">
                {noOptionsText}
              </CardContent>
            </Card>
          )}
        </div>

        {/* Vote Actions：已結束且無總結/結語內容時不渲染此區，避免讀取時結語上方留白 */}
        {(function () {
          const hasEndedContent = isTopicEnded && (
            !!aiClosing ||
            (aiClosingHasFetched && !aiClosingLoading)
          );
          if (isTopicEnded && !hasEndedContent) return null;
          return (
        <div className={`relative z-20 isolate bg-background mb-6 max-w-3xl mx-auto w-full px-4 sm:px-6 ${isTopicEnded ? '' : 'pt-1'} ${!isTopicEnded ? 'space-y-3' : ''}`}>
          {isTopicEnded ? (
            <>
              {/* 混亂結語：有 initial 或已取回則直接顯示，不顯示讀取遮罩；僅有結語時上方不留白 */}
              {aiClosing ? (
                <section
                  key={`closing-${closingDisplayLang}`}
                  aria-label={getText("chaos_closing.sectionLabel", "混亂結語")}
                  className="w-full space-y-2"
                >
                  <h2 className="text-lg font-semibold text-foreground sr-only">
                    {getText("chaos_closing.title", "⚡ 混亂結語")}
                  </h2>
                  <ChaosClosingCard
                    key={`chaos-closing-${aiClosing.topic_id}-${closingDisplayLang}`}
                    statement={aiClosing}
                    isLoading={false}
                    language={closingDisplayLang}
                  />
                </section>
              ) : aiClosingHasFetched && !aiClosingLoading ? (
                <section aria-label={getText("chaos_closing.sectionLabel", "混亂結語")} className="w-full">
                  <Card className="border-2 border-dashed border-muted-foreground/30 bg-muted/20">
                    <CardContent className="flex flex-col items-center justify-center py-6">
                      <p className="text-sm text-muted-foreground mb-3">
                        {getText("chaos_closing.notYet", "混亂結語尚未生成")}
                      </p>
                      {user && !isAnonymous && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => triggerAiClosing().then((r) => {
                            if (r.success && r.generated) toast.success(getText("chaos_closing.generateSuccess", "結語已產生"));
                            else if (r.error && isPromptConfigError(r.error)) {
                              const key = getPromptConfigKeyFromError(r.error);
                              if (key) {
                                setPromptConfigKey(key);
                                setPromptConfigDialogOpen(true);
                              }
                            } else if (r.error) toast.error(r.error);
                          })}
                          disabled={aiClosingGenerating}
                        >
                          {aiClosingGenerating ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            getText("chaos_closing.generateButton", "產生混亂結語")
                          )}
                        </Button>
                      )}
                    </CardContent>
                  </Card>
                </section>
              ) : null}
            </>
          ) : isAnonymous ? (
            <Card className="bg-muted/50 border-muted">
              <CardContent className="p-4 text-center">
                <User className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
                <h3 className="font-semibold text-foreground mb-2">{loginRequiredTitle}</h3>
                <p className="text-sm text-muted-foreground mb-3">
                  {anonymousCardDescription}
                </p>
                <Button
                  onClick={() => navigate("/auth")}
                  className="w-full"
                >
                  {anonymousButton}
                </Button>
              </CardContent>
            </Card>
          ) : (
            <>
              {/* Free Vote Button — 規格：accent；當日額度用畢改灰階（inline style 避免被 disabled 樣式覆蓋） */}
              <div className="mb-4 relative z-10">
                <Button
                  variant="accent"
                  size="lg"
                  onClick={handleFreeVote}
                  className="w-full h-16 text-lg"
                  style={!freeVoteAvailable && !checkingFreeVote ? { filter: "grayscale(1)", opacity: 0.9 } : undefined}
                  disabled={isVoting || !selectedOption || checkingFreeVote || !freeVoteAvailable}
                >
                  {isVoting ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : checkingFreeVote ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <>
                      <Gift className="w-5 h-5 mr-2" />
                      {freeVoteButtonText}
                    </>
                  )}
                </Button>
                <p className="text-xs text-muted-foreground text-center mt-2">
                  {freeVoteAvailable ? freeVoteNote : getText('vote.detail.freeVote.used', '今日免費票已使用')}
                </p>
              </div>

              <h3 className="text-lg font-semibold text-foreground mb-3">{tokenSectionTitle}</h3>
              <div className="grid grid-cols-3 gap-3 relative z-10">
                {voteButtonAmounts.map((amount) => (
                  <Button
                    key={amount}
                    variant={Number(amount) >= 100 ? "accent" : "vote"}
                    size="lg"
                    onClick={() => openVoteConfirmDialog(amount, 'quick')}
                    className="h-16 text-lg"
                    disabled={isVoting || !selectedOption}
                  >
                    {isVoting ? <Loader2 className="w-5 h-5 animate-spin" /> : (
                      <>
                        <Coins className="w-5 h-5 mr-2" />
                        +{amount}
                      </>
                    )}
                  </Button>
                ))}
              </div>

              {/* Custom Amount Input（按鈕用獨立層 z-20，Input 區 z-0 避免原生白底蓋住按鈕） */}
              <div className="mt-4 space-y-3 relative z-10">
                <h4 className="text-sm font-semibold text-muted-foreground">{customTitle}</h4>
                <div className="flex gap-2 items-stretch relative">
                  <div className="flex-1 min-w-0 relative z-0">
                    <Input
                      type="number"
                      placeholder={customPlaceholder}
                      value={customAmount}
                      onChange={(e) => setCustomAmount(e.target.value)}
                      min="1"
                      max="1000"
                      className="vote-page-custom-input h-12 text-lg bg-background"
                      disabled={isVoting || !selectedOption}
                    />
                  </div>
                  <div className="relative z-[20] shrink-0">
                    <Button
                      variant="vote"
                      size="lg"
                      className="h-12 px-6"
                    onClick={() => {
                      const amount = parseInt(customAmount);
                      if (isNaN(amount) || amount < 1) {
                        toast.error(customErrorInvalid);
                        return;
                      }
                      if (amount > 1000) {
                        toast.error(customErrorMax);
                        return;
                      }
                      openVoteConfirmDialog(amount, 'custom');
                    }}
                      disabled={isVoting || !selectedOption || !customAmount}
                    >
                      {isVoting ? <Loader2 className="w-5 h-5 animate-spin" /> : (
                        <>
                          <Coins className="w-5 h-5 mr-2" />
                          {customButtonText}
                        </>
                      )}
                    </Button>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  {balanceTemplate.replace('{{amount}}', userTokens.toLocaleString())}
                </p>
              </div>
            </>
          )}
        </div>
          ); })()}

        {/* Arena：代幣餘額下方、投票截止時間上方 */}
        <div className="max-w-3xl mx-auto w-full px-4 sm:px-6 mb-4">
          <ArenaSection
            topicId={id || ""}
            topicEndAt={topic.end_at || ""}
            userId={user?.id ?? null}
            isTopicEnded={isTopicEnded}
          />
        </div>

        {/* Info Card */}
        <div className="max-w-3xl mx-auto w-full px-4 sm:px-6">
          <Card className="bg-muted/50">
            <CardContent className="p-4">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">{deadlineLabel}</span>
                <span className="font-semibold text-foreground">
                  {format(new Date(topic.end_at), "yyyy/MM/dd HH:mm", { locale: zhTW })}
                </span>
              </div>
            </CardContent>
          </Card>
          {canExtendTime && (
            <div className="mt-2 flex items-center justify-end gap-3">
              <Button
                variant="outline"
                size="sm"
                disabled={!user || isAnonymous || isTopicEnded}
                onClick={() => setExtendDialogOpen(true)}
              >
                {getText("topic.influence.extend", "延長時間")}
              </Button>
              <span className="text-xs text-muted-foreground">
                {getText("topic.influence.remainingExtensions", "剩餘次數 {{remaining}}/{{max}}")
                  .replace("{{remaining}}", String(Math.max(0, (topic.max_extension_count ?? 3) - (topic.extension_count ?? 0))))
                  .replace("{{max}}", String(topic.max_extension_count ?? 3))}
              </span>
            </div>
          )}
        </div>
      </div>

      <AlertDialog
        open={confirmDialogOpen}
        onOpenChange={(isOpen) => {
          if (!isOpen) {
            handleCancelVote();
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirmDialogTitle}</AlertDialogTitle>
            <AlertDialogDescription>
              {confirmDialogDescriptionTemplate.replace('{{amount}}', pendingVoteAmount?.toLocaleString() || '0')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleCancelVote}>{confirmDialogCancelText}</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmVote}>
              {confirmDialogConfirmText}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* 延長投票時間 */}
      {canExtendTime && (
      <AlertDialog open={extendDialogOpen} onOpenChange={setExtendDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{getText("topic.influence.extendTitle", "延長投票時間")}</AlertDialogTitle>
            <AlertDialogDescription>
              {getText("topic.influence.extendDesc", "僅在剩餘時間接近結束時可操作，實際扣除以最新價格為準。")}
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="space-y-3">
            <div className="grid grid-cols-3 gap-2">
              {[1, 2, 3].map((d) => {
                const day = d as 1 | 2 | 3;
                const cost =
                  day === 1 ? influenceQuote?.costs?.extend_1_day :
                  day === 2 ? influenceQuote?.costs?.extend_2_day :
                  influenceQuote?.costs?.extend_3_day;
                return (
                  <Button
                    key={day}
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setExtendDays(day);
                      setExtendConfirmOpen(true);
                    }}
                    disabled={influenceLoading}
                    className="h-auto py-2"
                  >
                    <span className="w-full flex flex-col items-center leading-tight">
                      <span className="font-semibold">+{day}{getText("topic.influence.days", "天")}</span>
                      {typeof cost === "number" && cost > 0 && (
                        <span className="text-xs text-muted-foreground">（{cost} {getText("topic.influence.tokens", "代幣")}）</span>
                      )}
                    </span>
                  </Button>
                );
              })}
            </div>

            <div className="text-xs text-muted-foreground">
              {getText("topic.influence.extensionCount", "延長次數 {{count}}/{{max}}")
                .replace("{{count}}", String(topic?.extension_count ?? 0))
                .replace("{{max}}", String(topic?.max_extension_count ?? 3))}
            </div>
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel>{getText("common.button.cancel", "取消")}</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      )}

      {/* 延長投票時間：確認彈窗 */}
      {canExtendTime && (
      <AlertDialog open={extendConfirmOpen} onOpenChange={setExtendConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{getText("topic.influence.extendConfirmTitle", "確認延長")}</AlertDialogTitle>
            <AlertDialogDescription>
              {(() => {
                const cost =
                  extendDays === 1 ? influenceQuote?.costs?.extend_1_day :
                  extendDays === 2 ? influenceQuote?.costs?.extend_2_day :
                  influenceQuote?.costs?.extend_3_day;
                const line1 = getText("topic.influence.extendConfirmLine1", "將延長 +{{days}} 天").replace("{{days}}", String(extendDays));
                const line2 = typeof cost === "number" && cost > 0
                  ? getText("topic.influence.extendConfirmLine2", "扣除 {{cost}} 代幣").replace("{{cost}}", String(cost))
                  : getText("topic.influence.costLoading", "成本讀取中…");
                return `${line1}\n${line2}`;
              })()}
            </AlertDialogDescription>
          </AlertDialogHeader>

          <AlertDialogFooter>
            <AlertDialogCancel>{getText("common.button.cancel", "取消")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                if (!topic?.id) return;
                if (!user || isAnonymous) {
                  toast.error(getText("topic.influence.loginHint", "登入後才可使用互動擴充功能"));
                  return;
                }
                try {
                  setInfluenceLoading(true);
                  const { data, error } = await (supabase.rpc as any)("extend_topic_duration", {
                    p_topic_id: topic.id,
                    p_days: extendDays,
                  });
                  if (error) throw error;
                  toast.success(getText("topic.influence.extendSuccess", "已延長投票時間"));
                  setExtendConfirmOpen(false);
                  setExtendDialogOpen(false);
                  await refreshTopic();
                  await refreshProfile();
                  await refreshStats();
                  console.log("[Influence] extend_topic_duration result:", data);
                } catch (e: unknown) {
                  console.error("[Influence] extend_topic_duration failed:", e);
                  toast.error(getInfluenceErrorText(normalizeRpcError(e)));
                } finally {
                  setInfluenceLoading(false);
                }
              }}
              disabled={influenceLoading}
            >
              {influenceLoading ? (
                <span className="inline-flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  {getText("common.status.processing", "處理中")}
                </span>
              ) : (
                getText("topic.influence.confirm", "確認")
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      )}

      {/* 新增投票選項 */}
      {canAddOption && (
      <AlertDialog open={addOptionDialogOpen} onOpenChange={setAddOptionDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{getText("topic.influence.addOptionTitle", "新增投票選項")}</AlertDialogTitle>
            <AlertDialogDescription>
              {getText("topic.influence.addOptionDesc", "直接上架，不審核。實際扣除以最新價格為準。")}
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="space-y-2">
            <Input
              value={newOptionText}
              onChange={(e) => setNewOptionText(e.target.value)}
              placeholder={getText("topic.influence.optionPlaceholder", "輸入新選項")}
              maxLength={50}
              disabled={influenceLoading}
            />
            <div className="text-xs text-muted-foreground">
              {typeof influenceQuote?.costs?.add_option === "number" && influenceQuote.costs.add_option > 0
                ? getText("topic.influence.addOptionCost", "成本：{{cost}} tokens").replace("{{cost}}", String(influenceQuote.costs.add_option))
                : getText("topic.influence.costLoading", "成本讀取中…")}
            </div>
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel>{getText("common.button.cancel", "取消")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (!topic?.id) return;
                if (!user || isAnonymous) {
                  toast.error(getText("topic.influence.loginHint", "登入後才可使用互動擴充功能"));
                  return;
                }
                setAddOptionConfirmOpen(true);
              }}
              disabled={influenceLoading}
            >
              {influenceLoading ? (
                <span className="inline-flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  {getText("common.status.processing", "處理中")}
                </span>
              ) : (
                getText("topic.influence.confirm", "確認")
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      )}

      {/* 新增投票選項：確認彈窗 */}
      {canAddOption && (
      <AlertDialog open={addOptionConfirmOpen} onOpenChange={setAddOptionConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{getText("topic.influence.addOptionConfirmTitle", "確認新增選項")}</AlertDialogTitle>
            <AlertDialogDescription>
              {(() => {
                const cost = influenceQuote?.costs?.add_option;
                const line1 = getText("topic.influence.addOptionConfirmLine1", "新增選項：{{text}}")
                  .replace("{{text}}", (newOptionText || "").trim() || "（空白）");
                const line2 = typeof cost === "number" && cost > 0
                  ? getText("topic.influence.addOptionConfirmLine2", "扣除 {{cost}} 代幣").replace("{{cost}}", String(cost))
                  : getText("topic.influence.costLoading", "成本讀取中…");
                return `${line1}\n${line2}`;
              })()}
            </AlertDialogDescription>
          </AlertDialogHeader>

          <AlertDialogFooter>
            <AlertDialogCancel>{getText("common.button.cancel", "取消")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                if (!topic?.id) return;
                if (!user || isAnonymous) {
                  toast.error(getText("topic.influence.loginHint", "登入後才可使用互動擴充功能"));
                  return;
                }
                try {
                  setInfluenceLoading(true);
                  const { data, error } = await (supabase.rpc as any)("add_topic_option", {
                    p_topic_id: topic.id,
                    p_option_text: newOptionText,
                  });
                  if (error) throw error;
                  toast.success(getText("topic.influence.addOptionSuccess", "已新增選項"));
                  setAddOptionConfirmOpen(false);
                  setAddOptionDialogOpen(false);
                  setNewOptionText("");
                  await refreshTopic();
                  await refreshProfile();
                  await refreshStats();
                  console.log("[Influence] add_topic_option result:", data);
                } catch (e: unknown) {
                  console.error("[Influence] add_topic_option failed:", e);
                  toast.error(getInfluenceErrorText(normalizeRpcError(e)));
                } finally {
                  setInfluenceLoading(false);
                }
              }}
              disabled={influenceLoading}
            >
              {influenceLoading ? (
                <span className="inline-flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  {getText("common.status.processing", "處理中")}
                </span>
              ) : (
                getText("topic.influence.confirm", "確認")
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      )}

      {promptConfigKey && (
        <PromptNotConfiguredDialog
          open={promptConfigDialogOpen}
          onOpenChange={setPromptConfigDialogOpen}
          configKey={promptConfigKey}
          title={getText("chaos_closing.promptNotConfigured.title", "此功能需要後台設定")}
          description={getText("chaos_closing.promptNotConfigured.description", "請在後台「AI Prompt 管理」中設定以下 key，即可產生混亂結語。")}
        />
      )}
    </>
  );
};

export default VoteDetailPage;
