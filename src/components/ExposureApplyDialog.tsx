import { useState, useEffect, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Loader2, Coins, Sparkles, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useProfile } from "@/hooks/useProfile";
import { useAuth } from "@/hooks/useAuth";
import { useLanguage } from "@/contexts/LanguageContext";
import { useUIText } from "@/hooks/useUIText";
import { cn } from "@/lib/utils";

interface ExposureApplyDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  topicId: string;
  topicVotes: number;
  currentLevel: 'normal' | 'medium' | 'high';
  onSuccess?: () => void;
}

interface ExposureLimit {
  exposure_level: string;
  daily_limit: number;
  max_concurrent: number;
  min_votes_required: number;
  cooldown_hours: number;
  price: number;
  sort_weight_multiplier: number;
  top_duration_minutes: number;
}

export const ExposureApplyDialog = ({
  open,
  onOpenChange,
  topicId,
  topicVotes,
  currentLevel = 'normal',
  onSuccess,
}: ExposureApplyDialogProps) => {
  const { user } = useAuth();
  const { profile, refreshProfile } = useProfile();
  const { language } = useLanguage();
  const { getText } = useUIText(language);
  const [selectedLevel, setSelectedLevel] = useState<'normal' | 'medium' | 'high' | null>(null);
  const [limits, setLimits] = useState<ExposureLimit[]>([]);
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(false);
  const [checkResult, setCheckResult] = useState<any>(null);

  // 載入曝光限制配置
  useEffect(() => {
    if (open) {
      loadExposureLimits();
    }
  }, [open]);

  const loadExposureLimits = async () => {
    try {
      const { data, error } = await supabase
        .from('exposure_limits')
        .select('*')
        .order('price', { ascending: true });

      if (error) throw error;
      setLimits(data || []);
    } catch (err: any) {
      console.error('Error loading exposure limits:', err);
      toast.error(getText('exposure.error.loadFailed', '載入曝光方案失敗'));
    }
  };

  const handleCheck = async (level: 'normal' | 'medium' | 'high') => {
    if (!user?.id) {
      toast.error(getText('exposure.error.notAuthenticated', '請先登入'));
      return;
    }

    setChecking(true);
    setCheckResult(null);

    try {
      const { data, error } = await supabase.rpc('can_apply_exposure', {
        p_user_id: user.id,
        p_exposure_level: level,
        p_topic_id: topicId,
      });

      if (error) throw error;

      setCheckResult(data);
      if (data.allowed) {
        setSelectedLevel(level);
      } else {
        const reasonMessages: Record<string, string> = {
          daily_limit_exceeded: getText('exposure.error.dailyLimitExceeded', '今日申請次數已達上限（{{limit}}次）')
            .replace('{{limit}}', String(data.daily_limit)),
          max_concurrent_exceeded: getText('exposure.error.maxConcurrentExceeded', '同時最多只能有 {{max}} 個曝光主題')
            .replace('{{max}}', String(data.max_concurrent)),
          min_votes_not_met: getText('exposure.error.minVotesNotMet', '主題投票數需達到 {{required}} 票（目前：{{current}} 票）')
            .replace('{{required}}', String(data.min_votes_required))
            .replace('{{current}}', String(data.current_votes)),
          cooldown_active: getText('exposure.error.cooldownActive', '冷卻時間中，請於 {{time}} 後再試')
            .replace('{{time}}', new Date(data.cooldown_until).toLocaleString('zh-TW')),
          global_limit_exceeded: getText('exposure.error.globalLimitExceeded', '今日曝光額滿，請明日再試'),
          penalty_active: getText('exposure.error.penaltyActive', '因違規行為，曝光功能已暫停至 {{time}}')
            .replace('{{time}}', new Date(data.penalty_until).toLocaleString('zh-TW')),
          insufficient_tokens: getText('exposure.error.insufficientTokens', '代幣不足（需要：{{required}}，目前：{{current}}）')
            .replace('{{required}}', String(data.required))
            .replace('{{current}}', String(data.current)),
          already_at_or_higher: getText('exposure.error.alreadyAtOrHigher', '目前曝光等級已是相同或更高，無需升級'),
          not_topic_owner: getText('exposure.error.notTopicOwner', '只有主題建立者可以調整曝光等級'),
          topic_not_found: getText('exposure.error.topicNotFound', '找不到此主題，請重新整理頁面'),
        };
        toast.error(reasonMessages[data.reason] || getText('exposure.error.cannotApply', '無法申請曝光'));
      }
    } catch (err: any) {
      console.error('Error checking exposure:', err);
      toast.error(getText('exposure.error.checkFailed', '檢查失敗：{{message}}')
        .replace('{{message}}', err.message));
    } finally {
      setChecking(false);
    }
  };

  const handleApply = async () => {
    if (!selectedLevel || !user?.id) return;

    setLoading(true);

    try {
      const { data, error } = await supabase.rpc('apply_exposure', {
        p_topic_id: topicId,
        p_exposure_level: selectedLevel,
      });

      if (error) throw error;

      if (data.success) {
        toast.success(getText('exposure.success.applied', '曝光申請成功！'));
        await refreshProfile();
        onSuccess?.();
        onOpenChange(false);
        setSelectedLevel(null);
        setCheckResult(null);
      } else {
        const errorMessages: Record<string, string> = {
          not_authenticated: getText('exposure.error.notAuthenticated', '請先登入'),
          insufficient_tokens: getText('exposure.error.insufficientTokens', '代幣不足（需要：{{required}}，目前：{{current}}）')
            .replace('{{required}}', String(data.details?.required || 0))
            .replace('{{current}}', String(data.details?.current || 0)),
          daily_limit_exceeded: getText('exposure.error.dailyLimitExceeded', '今日申請次數已達上限（{{limit}}次）')
            .replace('{{limit}}', String(data.details?.daily_limit || '')),
          max_concurrent_exceeded: getText('exposure.error.maxConcurrentExceeded', '同時最多只能有 {{max}} 個曝光主題')
            .replace('{{max}}', String(data.details?.max_concurrent || 2)),
          min_votes_not_met: getText('exposure.error.minVotesNotMet', '主題投票數需達到 {{required}} 票（目前：{{current}} 票）')
            .replace('{{required}}', String(data.details?.min_votes_required || 20))
            .replace('{{current}}', String(topicVotes)),
          cooldown_active: getText('exposure.error.cooldownActive', '冷卻時間中，請於 {{time}} 後再試')
            .replace('{{time}}', '稍後'),
          global_limit_exceeded: getText('exposure.error.globalLimitExceeded', '今日曝光額滿，請明日再試'),
          penalty_active: getText('exposure.error.penaltyActive', '因違規行為，曝光功能已暫停至 {{time}}')
            .replace('{{time}}', '稍後'),
          already_at_or_higher: getText('exposure.error.alreadyAtOrHigher', '目前曝光等級已是相同或更高，無需升級'),
          not_topic_owner: getText('exposure.error.notTopicOwner', '只有主題建立者可以調整曝光等級'),
        };
        toast.error(errorMessages[data.error] || getText('exposure.error.applyFailed', '申請失敗：{{message}}')
          .replace('{{message}}', ''));
      }
    } catch (err: any) {
      console.error('Error applying exposure:', err);
      toast.error(getText('exposure.error.applyFailed', '申請失敗：{{message}}')
        .replace('{{message}}', err.message));
    } finally {
      setLoading(false);
    }
  };

  const getLevelInfo = (level: string) => {
    switch (level) {
      case 'normal':
        return {
          label: getText('exposure.dialog.level.normal.label', '普通曝光'),
          color: 'bg-gray-500/20 text-gray-300 border-gray-500/50',
          description: getText('exposure.dialog.level.normal.description', '基礎曝光方案，適合測試新主題'),
        };
      case 'medium':
        return {
          label: getText('exposure.dialog.level.medium.label', '中等曝光'),
          color: 'bg-silver-500/20 text-silver-300 border-silver-500/50',
          description: getText('exposure.dialog.level.medium.description', '提升中等排序權重，適合準熱門主題'),
        };
      case 'high':
        return {
          label: getText('exposure.dialog.level.high.label', '高度曝光'),
          color: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/50',
          description: getText('exposure.dialog.level.high.description', '強力曝光方案，置頂時間長達兩小時'),
        };
      default:
        return { label: '', color: '', description: '' };
    }
  };

  const userTokens = profile?.tokens || 0;
  const levelOrder = ['normal', 'medium', 'high'] as const;

  const currentRank = useMemo(
    () => {
      const idx = levelOrder.indexOf(currentLevel);
      return idx >= 0 ? idx : 0;
    },
    [currentLevel]
  );
  const currentLimit = useMemo(
    () => limits.find((limit) => limit.exposure_level === currentLevel),
    [limits, currentLevel]
  );

  const upgradeOptions = useMemo(
    () =>
      limits.filter(
        (limit) =>
          levelOrder.indexOf(limit.exposure_level as typeof levelOrder[number]) > currentRank
      ),
    [limits, currentRank]
  );

  const getPriceDiff = (targetLevel: string) => {
    const target = limits.find((limit) => limit.exposure_level === targetLevel);
    if (!target || !currentLimit) return target?.price ?? 0;
    return Math.max(target.price - currentLimit.price, 0);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>{getText('exposure.dialog.title', '申請主題曝光')}</DialogTitle>
          <DialogDescription>
            {getText('exposure.dialog.description', '選擇曝光方案以提升主題在熱門列表中的排序')}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* 用戶狀態 */}
          <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
            <div className="flex items-center gap-2">
              <Coins className="w-5 h-5 text-accent" />
              <span className="font-semibold">{getText('exposure.dialog.tokenBalance', '代幣餘額：')}{userTokens.toLocaleString()}</span>
            </div>
            <div className="text-sm text-muted-foreground">
              {getText('exposure.dialog.currentLevel', '目前等級：')}{getLevelInfo(currentLevel).label || getText('exposure.dialog.levelNotSet', '未設定')}
            </div>
          </div>

          {/* 投票數檢查 */}
          {topicVotes < 20 && (
            <div className="flex items-start gap-2 p-3 bg-yellow-500/10 border border-yellow-500/50 rounded-lg">
              <AlertCircle className="w-5 h-5 text-yellow-500 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-medium text-yellow-500">{getText('exposure.dialog.votesInsufficient', '投票數不足')}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {getText('exposure.dialog.votesInsufficientDesc', '主題投票數需達到 {{minVotes}} 票才能申請曝光（目前：{{currentVotes}} 票）')
                    .replace('{{minVotes}}', '20')
                    .replace('{{currentVotes}}', String(topicVotes))}
                </p>
              </div>
            </div>
          )}

          {/* 曝光方案選擇 */}
          {upgradeOptions.length === 0 ? (
            <div className="p-4 border rounded-lg text-sm text-muted-foreground">
              {getText('exposure.dialog.maxLevelReached', '已是最高曝光等級，無需再升級。')}
            </div>
          ) : (
            <RadioGroup
              value={selectedLevel || ''}
              onValueChange={(v) => {
                if (v) {
                  handleCheck(v as 'normal' | 'medium' | 'high');
                }
              }}
            >
              <div className="space-y-3">
                {upgradeOptions.map((limit) => {
                  const info = getLevelInfo(limit.exposure_level);
                  const priceDiff = getPriceDiff(limit.exposure_level);
                  const canAfford = userTokens >= priceDiff;
                  const hasEnoughVotes = topicVotes >= limit.min_votes_required;

                  return (
                    <Label
                      key={limit.exposure_level}
                      className={cn(
                        "flex items-start gap-3 p-4 border rounded-lg cursor-pointer transition-colors",
                        selectedLevel === limit.exposure_level
                          ? "border-primary bg-primary/5"
                          : "border-border hover:border-primary/50",
                        (!canAfford || !hasEnoughVotes || priceDiff <= 0) && "opacity-50 cursor-not-allowed"
                      )}
                    >
                      <RadioGroupItem
                        value={limit.exposure_level}
                        id={limit.exposure_level}
                        disabled={!canAfford || !hasEnoughVotes || checking || priceDiff <= 0}
                        className="mt-1"
                      />
                      <div className="flex-1">
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex items-center gap-2">
                            <Badge className={cn("text-xs", info.color)}>
                              {info.label}
                            </Badge>
                            <span className="text-sm font-medium">
                              {getText('exposure.dialog.priceDiff', '差額 {{amount}} 代幣')
                                .replace('{{amount}}', String(priceDiff))}
                            </span>
                          </div>
                        </div>
                        <p className="text-xs text-muted-foreground mb-2">
                          {info.description}
                        </p>
                        <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                          <span>{getText('exposure.dialog.sortWeight', '排序加權：+{{percent}}%')
                            .replace('{{percent}}', String(Math.round((limit.sort_weight_multiplier - 1) * 100)))}</span>
                        </div>
                        {!canAfford && (
                          <p className="text-xs text-red-500 mt-1">
                            {getText('exposure.dialog.tokensInsufficient', '代幣不足（需要 {{required}}，目前 {{current}}）')
                              .replace('{{required}}', String(priceDiff))
                              .replace('{{current}}', String(userTokens))}
                          </p>
                        )}
                        {!hasEnoughVotes && (
                          <p className="text-xs text-red-500 mt-1">
                            {getText('exposure.dialog.votesInsufficientOption', '投票數不足（需要 {{required}} 票）')
                              .replace('{{required}}', String(limit.min_votes_required))}
                          </p>
                        )}
                      </div>
                    </Label>
                  );
                })}
              </div>
            </RadioGroup>
          )}

          {checking && (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="w-5 h-5 animate-spin text-primary" />
              <span className="ml-2 text-sm text-muted-foreground">{getText('exposure.dialog.checking', '檢查中...')}</span>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => {
              onOpenChange(false);
              setSelectedLevel(null);
              setCheckResult(null);
            }}
            disabled={loading}
          >
            {getText('exposure.dialog.button.cancel', '取消')}
          </Button>
          <Button
            onClick={handleApply}
            disabled={!selectedLevel || loading || checking}
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                {getText('exposure.dialog.button.applying', '申請中...')}
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4 mr-2" />
                {getText('exposure.dialog.button.confirm', '確認申請')}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

