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
      toast.error('載入曝光方案失敗');
    }
  };

  const handleCheck = async (level: 'normal' | 'medium' | 'high') => {
    if (!user?.id) {
      toast.error('請先登入');
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
          daily_limit_exceeded: `今日申請次數已達上限（${data.daily_limit}次）`,
          max_concurrent_exceeded: `同時最多只能有 ${data.max_concurrent} 個曝光主題`,
          min_votes_not_met: `主題投票數需達到 ${data.min_votes_required} 票（目前：${data.current_votes} 票）`,
          cooldown_active: `冷卻時間中，請於 ${new Date(data.cooldown_until).toLocaleString('zh-TW')} 後再試`,
          global_limit_exceeded: '今日曝光額滿，請明日再試',
          penalty_active: `因違規行為，曝光功能已暫停至 ${new Date(data.penalty_until).toLocaleString('zh-TW')}`,
          insufficient_tokens: `代幣不足（需要：${data.required}，目前：${data.current}）`,
          already_at_or_higher: '目前曝光等級已是相同或更高，無需升級',
          not_topic_owner: '只有主題建立者可以調整曝光等級',
          topic_not_found: '找不到此主題，請重新整理頁面',
        };
        toast.error(reasonMessages[data.reason] || '無法申請曝光');
      }
    } catch (err: any) {
      console.error('Error checking exposure:', err);
      toast.error('檢查失敗：' + err.message);
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
        toast.success('曝光申請成功！');
        await refreshProfile();
        onSuccess?.();
        onOpenChange(false);
        setSelectedLevel(null);
        setCheckResult(null);
      } else {
        const errorMessages: Record<string, string> = {
          not_authenticated: '請先登入',
          insufficient_tokens: `代幣不足（需要：${data.details?.required || 0}，目前：${data.details?.current || 0}）`,
          daily_limit_exceeded: '今日申請次數已達上限',
          max_concurrent_exceeded: '同時最多只能有 2 個曝光主題',
          min_votes_not_met: `主題投票數需達到 ${data.details?.min_votes_required || 20} 票`,
          cooldown_active: '冷卻時間中，請稍後再試',
          global_limit_exceeded: '今日曝光額滿，請明日再試',
          penalty_active: '因違規行為，曝光功能已暫停',
          already_at_or_higher: '目前曝光等級已是相同或更高，無法重複升級',
          not_topic_owner: '只有主題建立者可以調整曝光等級',
        };
        toast.error(errorMessages[data.error] || '申請失敗');
      }
    } catch (err: any) {
      console.error('Error applying exposure:', err);
      toast.error('申請失敗：' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const getLevelInfo = (level: string) => {
    switch (level) {
      case 'normal':
        return {
          label: '普通曝光',
          color: 'bg-gray-500/20 text-gray-300 border-gray-500/50',
          description: '基礎曝光方案，適合測試新主題',
        };
      case 'medium':
        return {
          label: '中等曝光',
          color: 'bg-silver-500/20 text-silver-300 border-silver-500/50',
          description: '提升中等排序權重，適合準熱門主題',
        };
      case 'high':
        return {
          label: '高度曝光',
          color: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/50',
          description: '強力曝光方案，置頂時間長達兩小時',
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
          <DialogTitle>申請主題曝光</DialogTitle>
          <DialogDescription>
            選擇曝光方案以提升主題在熱門列表中的排序
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* 用戶狀態 */}
          <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
            <div className="flex items-center gap-2">
              <Coins className="w-5 h-5 text-accent" />
              <span className="font-semibold">代幣餘額：{userTokens.toLocaleString()}</span>
            </div>
            <div className="text-sm text-muted-foreground">
              目前等級：{getLevelInfo(currentLevel).label || '未設定'}
            </div>
          </div>

          {/* 投票數檢查 */}
          {topicVotes < 20 && (
            <div className="flex items-start gap-2 p-3 bg-yellow-500/10 border border-yellow-500/50 rounded-lg">
              <AlertCircle className="w-5 h-5 text-yellow-500 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-medium text-yellow-500">投票數不足</p>
                <p className="text-xs text-muted-foreground mt-1">
                  主題投票數需達到 20 票才能申請曝光（目前：{topicVotes} 票）
                </p>
              </div>
            </div>
          )}

          {/* 曝光方案選擇 */}
          {upgradeOptions.length === 0 ? (
            <div className="p-4 border rounded-lg text-sm text-muted-foreground">
              已是最高曝光等級，無需再升級。
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
                              差額 {priceDiff} 代幣
                            </span>
                          </div>
                        </div>
                        <p className="text-xs text-muted-foreground mb-2">
                          {info.description}
                        </p>
                        <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                          <span>排序加權：+{Math.round((limit.sort_weight_multiplier - 1) * 100)}%</span>
                        </div>
                        {!canAfford && (
                          <p className="text-xs text-red-500 mt-1">
                            代幣不足（需要 {priceDiff}，目前 {userTokens}）
                          </p>
                        )}
                        {!hasEnoughVotes && (
                          <p className="text-xs text-red-500 mt-1">
                            投票數不足（需要 {limit.min_votes_required} 票）
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
              <span className="ml-2 text-sm text-muted-foreground">檢查中...</span>
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
            取消
          </Button>
          <Button
            onClick={handleApply}
            disabled={!selectedLevel || loading || checking}
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                申請中...
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4 mr-2" />
                確認申請
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

