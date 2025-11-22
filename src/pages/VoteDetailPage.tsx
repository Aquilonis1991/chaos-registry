import { useState, useEffect } from "react";
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
import { ArrowLeft, User, Clock, Coins, Loader2, Gift, Flag, Sparkles } from "lucide-react";
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
import { useLanguage } from "@/contexts/LanguageContext";
import { useUIText } from "@/hooks/useUIText";
import { formatRelativeTime, formatRemainingTime } from "@/lib/relativeTime";

const VoteDetailPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { profile, loading: profileLoading, refreshProfile } = useProfile();
  const { user, isAnonymous } = useAuth();
  const { castVote, castFreeVote, checkFreeVoteAvailable } = useVoteOperations();
  const { topic, loading: topicLoading, refreshTopic } = useTopicDetail(id);
  const { refreshStats } = useUserStats(user?.id);
  const { language } = useLanguage();
  const { getText, isLoading: uiTextsLoading } = useUIText(language);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [isVoting, setIsVoting] = useState(false);
  const [freeVoteAvailable, setFreeVoteAvailable] = useState(false);
  const [checkingFreeVote, setCheckingFreeVote] = useState(false);
  const [customAmount, setCustomAmount] = useState<string>("");
  const [exposureDialogOpen, setExposureDialogOpen] = useState(false);
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [pendingVoteAmount, setPendingVoteAmount] = useState<number | null>(null);
  const [pendingVoteSource, setPendingVoteSource] = useState<'quick' | 'custom' | null>(null);

  const selectOptionText = getText('vote.detail.error.selectOption', '請先選擇一個選項');
  const loginRequiredTitle = getText('vote.detail.error.loginRequired.title', '需要註冊才能投票');
  const loginRequiredDescription = getText('vote.detail.error.loginRequired.description', '請先註冊帳號以參與投票');
  const needLoginText = getText('vote.detail.error.requireLogin', '請先登入');
  const insufficientTokensText = getText('vote.detail.error.insufficientTokens', '代幣不足！');
  const invalidDataText = getText('vote.detail.error.invalidData', '投票資料無效');
  const voteSuccessTemplate = getText('vote.detail.toast.voteSuccess', '成功投票 {{amount}} 代幣！');
  const voteRecordedDescription = getText('vote.detail.toast.voteSuccessDesc', '你的選擇已記錄');
  const freeVoteSuccessTitle = getText('vote.detail.toast.freeVoteSuccess', '免費票投票成功！');
  const freeVoteSuccessDescription = getText('vote.detail.toast.freeVoteSuccessDesc', '你的選擇已記錄');
  const headerTitle = getText('vote.detail.header.title', '投票詳情');
  const topicNotFoundTitle = getText('vote.detail.empty.title', '主題不存在');
  const topicNotFoundDescription = getText('vote.detail.empty.description', '找不到此投票主題');
  const backHomeButton = getText('vote.detail.empty.backHome', '返回首頁');
  const chooseAnswerTitle = getText('vote.detail.section.answers', '選擇你的答案');
  const noOptionsText = getText('vote.detail.options.empty', '此主題暫無選項');
  const selectedMark = getText('vote.detail.option.selected', '✓ 已選擇');
  const selectedLabelTemplate = getText('vote.detail.option.selectedLabel', '✓ 已選擇：{{option}}');
  const unknownOptionText = getText('vote.detail.option.unknown', '未知選項');
  const anonymousCardDescription = getText('vote.detail.anonymous.description', '匿名瀏覽模式下無法投票，請註冊帳號以參與投票活動');
  const anonymousButton = getText('vote.detail.anonymous.button', '前往註冊');
  const freeVoteButtonText = getText('vote.detail.freeVote.button', '免費投票');
  const freeVoteNote = getText('vote.detail.freeVote.note', '每日每主題可免費投票一次');
  const tokenSectionTitle = getText('vote.detail.section.tokens', '投入代幣');
  const customTitle = getText('vote.detail.custom.title', '自訂票數');
  const customPlaceholder = getText('vote.detail.custom.placeholder', '輸入票數（1-1000）');
  const customErrorInvalid = getText('vote.detail.custom.error.invalid', '請輸入有效的票數（至少 1）');
  const customErrorMax = getText('vote.detail.custom.error.max', '單次投票最多 1000 票');
  const customButtonText = getText('vote.detail.custom.button', '投票');
  const balanceTemplate = getText('vote.detail.custom.balance', '當前持有：{{amount}} 代幣');
  const deadlineLabel = getText('vote.detail.info.deadline', '投票截止時間');
  const reportButtonText = getText('vote.detail.report.button', '檢舉');
  const upgradeExposureText = getText('vote.detail.exposure.upgrade', '升級曝光');
  const confirmDialogTitle = getText('vote.detail.confirm.title', '確認投入代幣');
  const confirmDialogDescriptionTemplate = getText('vote.detail.confirm.description', '確定要投入 {{amount}} 代幣給此選項？此操作會立即扣除代幣。');
  const confirmDialogCancelText = getText('vote.detail.confirm.cancel', '取消');
  const confirmDialogConfirmText = getText('vote.detail.confirm.confirm', '確認投入');

  // Check free vote availability when component mounts
  useEffect(() => {
    if (user && !isAnonymous && id) {
      setCheckingFreeVote(true);
      checkFreeVoteAvailable(id)
        .then(setFreeVoteAvailable)
        .catch((error) => {
          console.error('Error checking free vote:', error);
          setFreeVoteAvailable(false);
        })
        .finally(() => setCheckingFreeVote(false));
    } else {
      setFreeVoteAvailable(false);
      setCheckingFreeVote(false);
    }
  }, [user, isAnonymous, id]); // 移除 checkFreeVoteAvailable 避免無限循環
  
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
      // 刷新用戶資料以更新代幣顯示
      refreshProfile();
      // 刷新任務統計
      refreshStats();
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

  if (profileLoading || topicLoading || uiTextsLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
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
  const createdAtLabel = formatRelativeTime(new Date(topic.created_at), getText);
  const remainingTimeLabel = formatRemainingTime(new Date(topic.end_at), getText);
  const isCreator = Boolean(user && topic.creator_id === user.id);

  return (
    <>
      <div className="min-h-screen bg-background pb-6">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-gradient-primary shadow-lg">
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
          <h2 className="text-2xl font-bold text-foreground mb-3">
            {topic.title}
          </h2>
          
          <div className="flex flex-wrap gap-2 mb-4">
            {topic.tags.map((tag) => (
              <Badge key={tag} variant="secondary">
                #{tag}
              </Badge>
            ))}
          </div>
          
          {topic.description && (
            <p className="text-muted-foreground mb-4">
              {topic.description}
            </p>
          )}
          
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="flex flex-wrap gap-3 text-sm text-muted-foreground">
              <div className="flex items-center gap-1">
                <User className="w-4 h-4" />
                <span>{topic.creator_name}</span>
              </div>
              <div className="flex items-center gap-1">
                <Clock className="w-4 h-4" />
                <span>{createdAtLabel}</span>
              </div>
              <div className="flex items-center gap-1">
                <Clock className="w-4 h-4" />
                <span>{remainingTimeLabel}</span>
              </div>
            </div>
            
            {/* Action Buttons */}
            <div className="w-full">
              <div className={`grid gap-3 ${isCreator ? 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-4' : 'grid-cols-2'}`}>
                {/* 編輯和刪除按鈕（僅創建者可見）*/}
                {isCreator && (
                  <>
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
                    {/* 曝光升級按鈕 */}
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
                  </>
                )}
                
                {/* Report Button */}
                <div className="w-full">
                  <ReportDialog
                    targetType="topic"
                    targetId={id || ""}
                    targetTitle={topic.title}
                    trigger={
                      <Button
                        variant="ghost"
                        size="sm"
                        className="w-full text-muted-foreground hover:text-destructive"
                      >
                        <Flag className="w-4 h-4 mr-2" />
                        {reportButtonText}
                      </Button>
                    }
                  />
                </div>
              </div>
            </div>
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

        {/* Vote Options */}
        <div className="space-y-3 mb-6 max-w-3xl mx-auto w-full px-4 sm:px-6">
          <h3 className="text-lg font-semibold text-foreground mb-3">{chooseAnswerTitle}</h3>
          {topic.options && topic.options.length > 0 ? (
            topic.options.map((option, index) => {
              // 確保選項有 id（兼容舊格式）
              const optionId = option.id || option?.id || (typeof option === 'string' ? `option-${index}` : `option-${index}`);
              const optionText = option?.text || (typeof option === 'string' ? option : unknownOptionText);
              const percentage = totalVotes > 0 ? ((option?.votes || 0) / totalVotes) * 100 : 0;
              const isSelected = selectedOption === optionId;
              
              return (
                <Card
                  key={optionId}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    console.log('Option clicked:', { optionId, option, selectedOption });
                    setSelectedOption(optionId);
                  }}
                  className={`cursor-pointer transition-all hover:shadow-glow ${
                    isSelected ? "ring-2 ring-primary shadow-glow bg-primary/5" : "hover:bg-muted/50"
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
                      <div className="text-xs text-primary mt-2">{selectedMark}</div>
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
          {/* Debug info - 顯示已選擇的選項文字 */}
          {selectedOption && (() => {
            const selected = topic.options?.find((opt, idx) => {
              const optId = opt?.id || opt?.id || (typeof opt === 'string' ? `option-${idx}` : `option-${idx}`);
              return optId === selectedOption;
            });
            const selectedText = selected?.text || (typeof selected === 'string' ? selected : unknownOptionText);
            return selectedText ? (
              <div className="text-xs text-primary mt-2 font-medium">
                {selectedLabelTemplate.replace('{{option}}', selectedText)}
              </div>
            ) : null;
          })()}
        </div>

        {/* Vote Actions */}
        <div className="space-y-3 mb-6 max-w-3xl mx-auto w-full px-4 sm:px-6">
          {isAnonymous ? (
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
              {/* Free Vote Button */}
              {freeVoteAvailable && (
                <div className="mb-4">
                  <Button
                    variant="default"
                    size="lg"
                    onClick={handleFreeVote}
                    className="w-full h-16 text-lg bg-gradient-accent"
                    disabled={isVoting || !selectedOption || checkingFreeVote}
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
                    {freeVoteNote}
                  </p>
                </div>
              )}

              <h3 className="text-lg font-semibold text-foreground mb-3">{tokenSectionTitle}</h3>
              <div className="grid grid-cols-3 gap-3">
                <Button
                  variant="vote"
                  size="lg"
                  onClick={() => openVoteConfirmDialog(1, 'quick')}
                  className="h-16 text-lg"
                  disabled={isVoting || !selectedOption}
                >
                  {isVoting ? <Loader2 className="w-5 h-5 animate-spin" /> : (
                    <>
                      <Coins className="w-5 h-5 mr-2" />
                      +1
                    </>
                  )}
                </Button>
                <Button
                  variant="vote"
                  size="lg"
                  onClick={() => openVoteConfirmDialog(10, 'quick')}
                  className="h-16 text-lg"
                  disabled={isVoting || !selectedOption}
                >
                  {isVoting ? <Loader2 className="w-5 h-5 animate-spin" /> : (
                    <>
                      <Coins className="w-5 h-5 mr-2" />
                      +10
                    </>
                  )}
                </Button>
                <Button
                  variant="accent"
                  size="lg"
                  onClick={() => openVoteConfirmDialog(100, 'quick')}
                  className="h-16 text-lg"
                  disabled={isVoting || !selectedOption}
                >
                  {isVoting ? <Loader2 className="w-5 h-5 animate-spin" /> : (
                    <>
                      <Coins className="w-5 h-5 mr-2" />
                      +100
                    </>
                  )}
                </Button>
              </div>

              {/* Custom Amount Input */}
              <div className="mt-4 space-y-3">
                <h4 className="text-sm font-semibold text-muted-foreground">{customTitle}</h4>
                <div className="flex gap-2">
                  <div className="flex-1">
                    <Input
                      type="number"
                      placeholder={customPlaceholder}
                      value={customAmount}
                      onChange={(e) => setCustomAmount(e.target.value)}
                      min="1"
                      max="1000"
                      className="h-12 text-lg"
                      disabled={isVoting || !selectedOption}
                    />
                  </div>
                  <Button
                    variant="vote"
                    size="lg"
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
                    className="h-12 px-6"
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
                <p className="text-xs text-muted-foreground">
                  {balanceTemplate.replace('{{amount}}', userTokens.toLocaleString())}
                </p>
              </div>
            </>
          )}
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
    </>
  );
};

export default VoteDetailPage;
