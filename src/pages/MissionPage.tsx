import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Gift, Coins, Video, CheckCircle, Clock, Loader2, Calendar } from "lucide-react";
import { toast } from "sonner";
import { useMissionOperations } from "@/hooks/useMissionOperations";
import { useProfile } from "@/hooks/useProfile";
import { useUserStats } from "@/hooks/useUserStats";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";
import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";
import { useUIText } from "@/hooks/useUIText";

// 任務映射：前端任務 ID -> 數據庫任務 ID
const MISSION_ID_MAP: Record<string, string> = {
  "1": "first_vote",      // 新手上路（需要創建）
  "2": "vote_lover",      // 投票愛好者
  "3": "topic_creator",   // 話題創造者
  "4": "login_7days",     // 7天登入
};

const MISSION_TEMPLATES = [
  {
    id: "1",
    name: "新手上路",
    description: "完成第一次投票",
    condition: "投票 1 次",
    reward: 50,
  },
  {
    id: "2",
    name: "投票愛好者",
    description: "對 10 個不同主題進行投票",
    condition: "投票 10 次",
    reward: 50,
  },
  {
    id: "3",
    name: "話題創造者",
    description: "發起一個主題",
    condition: "發起主題 1 次",
    reward: 50,
  },
  {
    id: "4",
    name: "7天登入",
    description: "連續登入 7 天",
    condition: "連續登入 7 天",
    reward: 100,
  },
];

const MissionPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { profile, refreshProfile } = useProfile();
  const { stats, loading: statsLoading, refreshStats } = useUserStats(user?.id);
  const { watchAd, claimDailyLogin, getLoginStreakInfo, completeMission } = useMissionOperations();
  const { language } = useLanguage();
  const { getText, isLoading: uiTextsLoading } = useUIText(language);
  const [isWatchingAd, setIsWatchingAd] = useState(false);
  const [isClaimingLogin, setIsClaimingLogin] = useState(false);
  const [loginStreakInfo, setLoginStreakInfo] = useState<any>(null);
  const [loadingStreak, setLoadingStreak] = useState(true);
  const [userMissions, setUserMissions] = useState<Record<string, { completed: boolean; completed_at: string | null }>>({});
  const [loadingMissions, setLoadingMissions] = useState(true);
  const [claimingMissionId, setClaimingMissionId] = useState<string | null>(null);

  const userTokens = profile?.tokens || 0;

  const localizedMissions = useMemo(() => {
    return MISSION_TEMPLATES.map((mission) => ({
      ...mission,
      name: getText(`mission.list.${mission.id}.name`, mission.name),
      description: getText(`mission.list.${mission.id}.description`, mission.description),
      condition: getText(`mission.list.${mission.id}.condition`, mission.condition),
    }));
  }, [getText, language]);

  const headerTitle = getText('mission.header.title', '任務與獎勵');
  const headerSubtitle = getText('mission.header.subtitle', '完成任務賺代幣');
  const dailyCheckInTitle = getText('mission.daily.title', '每日簽到');
  const dailyCheckInLoading = getText('mission.daily.loading', '載入中...');
  const dailyCheckInPending = getText('mission.daily.pending', '今日還未簽到');
  const dailyCheckInCompleted = getText('mission.daily.completed', '今日已簽到');
  const dailyCheckInButtonClaiming = getText('mission.daily.button.claiming', '簽到中...');
  const dailyCheckInButtonDone = getText('mission.daily.button.done', '今日已簽到');
  const dailyCheckInButtonAction = getText('mission.daily.button.action', '立即簽到');
  const dailyCheckInReward = getText('mission.daily.reward', '+3');
  const watchAdTitle = getText('mission.ad.title', '觀看廣告');
  const watchAdSubtitle = getText('mission.ad.subtitle', '輕鬆賺取代幣');
  const watchAdReward = getText('mission.ad.reward', '+5');
  const watchAdLoading = getText('mission.ad.loading', '載入中...');
  const watchAdButton = getText('mission.ad.button', '觀看 30 秒廣告');
  const missionsSectionTitle = getText('mission.list.title', '任務列表');
  const missionInProgress = getText('mission.list.inProgress', '進行中');
  const missionProgressTemplate = getText('mission.list.progress', '{{percent}}% 完成');
  const missionClaiming = getText('mission.list.claiming', '領取中...');
  const missionClaimButton = getText('mission.list.claimButton', '領取獎勵');
  const missionClaimed = getText('mission.list.claimed', '已領取');
  const infoCardTitle = getText('mission.info.title', '💡 儲值說明');
  const infoCardItems = [
    getText('mission.info.item1', '• 代幣可用於投票、發起主題等功能'),
    getText('mission.info.item2', '• 儲值金額越高，贈送代幣越多'),
    getText('mission.info.item3', '• 完成每日任務也可免費獲得代幣'),
    getText('mission.info.item4', '• 代幣永久有效，不會過期'),
  ];
  const mobileNoteTitle = getText('mission.mobile.title', '📱 關於行動應用內購');
  const mobileNoteDescription = getText('mission.mobile.description', '如需整合 Google Play 或 App Store 內購功能，需要使用 Capacitor 將應用打包為原生行動應用。目前的網頁版使用模擬購買流程。');
  const missionAlreadyClaimedInfo = getText('mission.toast.alreadyClaimed', '任務獎勵已領取');
  const missionIdMissingError = getText('mission.toast.missionMissing', '任務 ID 不存在');
  const claimSuccessTitle = getText('mission.toast.claimSuccess.title', '獎勵領取成功！');
  const claimSuccessDescTemplate = getText('mission.toast.claimSuccess.desc', '獲得 {{amount}} 代幣');
  const claimErrorTitle = getText('mission.toast.claimError.title', '領取獎勵失敗');
  const genericTryAgain = getText('mission.toast.tryAgain', '請稍後再試');
  const watchAdSuccessTitle = getText('mission.toast.watchAdSuccess.title', '觀看廣告完成！');
  const watchAdSuccessDescTemplate = getText('mission.toast.watchAdSuccess.desc', '獲得 {{amount}} 代幣');

  // 載入用戶任務完成狀態
  useEffect(() => {
    loadUserMissions();
  }, [user?.id]);

  // 當頁面聚焦時也刷新任務狀態
  useEffect(() => {
    const handleFocus = () => {
      if (user?.id) {
        loadUserMissions();
      }
    };

    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [user?.id]);

  const loadUserMissions = async () => {
    if (!user?.id) {
      setLoadingMissions(false);
      return;
    }

    try {
      setLoadingMissions(true);
      const { data, error } = await supabase
        .from('user_missions')
        .select('mission_id, completed, completed_at')
        .eq('user_id', user.id);

      if (error) throw error;

      const missionsMap: Record<string, { completed: boolean; completed_at: string | null }> = {};
      data?.forEach((mission) => {
        missionsMap[mission.mission_id] = {
          completed: mission.completed,
          completed_at: mission.completed_at,
        };
      });

      setUserMissions(missionsMap);
    } catch (error) {
      console.error('Error loading user missions:', error);
    } finally {
      setLoadingMissions(false);
    }
  };

  // 當頁面聚焦時刷新統計（確保數據是最新的）
  useEffect(() => {
    const handleFocus = () => {
      if (user?.id) {
        refreshStats();
      }
    };

    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [user?.id, refreshStats]);

  // 計算任務進度
  const getMissionProgress = (missionId: string): { progress: number; completed: boolean } => {
    if (statsLoading) {
      return { progress: 0, completed: false };
    }

    const dbMissionId = MISSION_ID_MAP[missionId];
    const isClaimed = dbMissionId ? userMissions[dbMissionId]?.completed === true : false;

    console.log('📊 Mission Progress Calculation:', {
      missionId,
      dbMissionId,
      isClaimed,
      stats: {
        totalVotes: stats.totalVotes,
        uniqueTopicVotes: stats.uniqueTopicVotes,
        topicsCreated: stats.topicsCreated
      },
      userMissions: userMissions
    });

    // 如果已領取，任務視為已完成（即使統計數據為 0）
    if (isClaimed) {
      return { progress: 100, completed: true };
    }

    switch (missionId) {
      case "1": // 新手上路：完成第一次投票
        const voteProgress = stats.totalVotes > 0 ? 100 : 0;
        return {
          progress: voteProgress,
          completed: stats.totalVotes > 0
        };
      case "2": // 投票愛好者：對 10 個不同主題進行投票
        // 使用 uniqueTopicVotes 計算不重複的主題投票數
        const uniqueTopics = stats.uniqueTopicVotes || 0;
        const uniqueProgress = Math.min((uniqueTopics / 10) * 100, 100);
        return {
          progress: uniqueProgress,
          completed: uniqueTopics >= 10
        };
      case "3": // 話題創造者：發起一個主題
        const topicProgress = stats.topicsCreated > 0 ? 100 : 0;
        return {
          progress: topicProgress,
          completed: stats.topicsCreated > 0
        };
      case "4": // 7天登入：連續登入 7 天
        return {
          progress: loginStreakInfo ? Math.min((loginStreakInfo.current_streak / 7) * 100, 100) : 0,
          completed: loginStreakInfo ? loginStreakInfo.current_streak >= 7 : false
        };
      default:
        return { progress: 0, completed: false };
    }
  };

  // 載入登入連勝資訊
  useEffect(() => {
    loadLoginStreak();
  }, []);

  const loadLoginStreak = async () => {
    setLoadingStreak(true);
    try {
      const info = await getLoginStreakInfo();
      setLoginStreakInfo(info);
    } catch (error) {
      console.error('Error loading login streak:', error);
    } finally {
      setLoadingStreak(false);
    }
  };

  const handleWatchAd = async () => {
    if (isWatchingAd) return;
    
    setIsWatchingAd(true);
    try {
      const result = await watchAd();
      const adRewardAmount = (result.reward ?? 0).toLocaleString();
      toast.success(watchAdSuccessTitle, {
        description: watchAdSuccessDescTemplate.replace('{{amount}}', adRewardAmount)
      });
      // 刷新代幣顯示
      await refreshProfile();
    } catch (error) {
      // Error handled in useMissionOperations
    } finally {
      setIsWatchingAd(false);
    }
  };

  const handleDailyLogin = async () => {
    if (isClaimingLogin) return;
    
    setIsClaimingLogin(true);
    try {
      await claimDailyLogin();
      // 重新載入連勝資訊
      await loadLoginStreak();
      // 刷新代幣顯示
      await refreshProfile();
    } catch (error) {
      // Error handled in useMissionOperations
    } finally {
      setIsClaimingLogin(false);
    }
  };

  const handleClaimReward = async (missionId: string) => {
    const dbMissionId = MISSION_ID_MAP[missionId];
    if (!dbMissionId) {
      toast.error(missionIdMissingError);
      return;
    }

    // 防止重複點擊（前端防護）
    if (claimingMissionId === missionId) return;
    
    // 檢查是否已領取（額外的前端檢查）
    if (isRewardClaimed(missionId)) {
      toast.info(missionAlreadyClaimedInfo);
      return;
    }

    setClaimingMissionId(missionId);
    try {
      const result = await completeMission(dbMissionId);
      if (result?.success) {
        const rewardAmount = result.reward || localizedMissions.find(m => m.id === missionId)?.reward || 0;
        const claimDesc = claimSuccessDescTemplate.replace('{{amount}}', rewardAmount.toLocaleString());
        toast.success(claimSuccessTitle, {
          description: claimDesc
        });
        // 重新載入任務狀態
        await loadUserMissions();
        // 刷新代幣顯示
        await refreshProfile();
        // 刷新統計數據
        await refreshStats();
      }
    } catch (error: any) {
      console.error('Claim reward error:', error);
      // 如果錯誤信息中沒有包含特定的錯誤提示，顯示通用錯誤
      if (!error.message?.includes('已完成') && !error.message?.includes('已達上限')) {
        toast.error(claimErrorTitle, {
          description: error.message || genericTryAgain
        });
      }
      // 即使出錯也重新載入任務狀態，因為可能已經部分完成
      await loadUserMissions();
    } finally {
      setClaimingMissionId(null);
    }
  };

  // 檢查任務是否已領取獎勵
  const isRewardClaimed = (missionId: string): boolean => {
    const dbMissionId = MISSION_ID_MAP[missionId];
    if (!dbMissionId) return false;
    return userMissions[dbMissionId]?.completed === true;
  };

  if (uiTextsLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-gradient-primary shadow-lg">
        <div className="max-w-screen-xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Gift className="w-7 h-7 text-accent" />
              <div>
                <h1 className="text-xl font-bold text-primary-foreground">{headerTitle}</h1>
                <p className="text-sm text-primary-foreground/80">{headerSubtitle}</p>
              </div>
            </div>
            <button 
              onClick={() => navigate('/recharge')}
              className="flex items-center gap-2 bg-primary-foreground/20 backdrop-blur-sm px-4 py-2 rounded-full hover:bg-primary-foreground/30 transition-colors cursor-pointer"
            >
              <Coins className="w-5 h-5 text-accent" />
              <span className="font-bold text-primary-foreground">{userTokens.toLocaleString()}</span>
            </button>
          </div>
        </div>
      </header>

      {/* Content */}
      <div className="max-w-screen-xl mx-auto px-4 py-6 space-y-6">
        {/* Daily Login Card */}
        <Card className="bg-gradient-to-r from-blue-500 to-purple-600 shadow-glow">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center">
                  <Calendar className="w-6 h-6 text-white" />
                </div>
                <div className="text-white">
                  <h3 className="font-bold text-lg">{dailyCheckInTitle}</h3>
                  <p className="text-sm opacity-90">
                    {loadingStreak ? dailyCheckInLoading : 
                      loginStreakInfo?.can_claim_today ? dailyCheckInPending : dailyCheckInCompleted}
                  </p>
                </div>
              </div>
              <div className="text-right text-white">
                <div className="text-2xl font-bold flex items-center gap-1">
                  <Coins className="w-6 h-6" />
                  {dailyCheckInReward}
                </div>
              </div>
            </div>

            <Button
              variant="secondary"
              size="lg"
              className="w-full"
              onClick={handleDailyLogin}
              disabled={isClaimingLogin || (loginStreakInfo && !loginStreakInfo.can_claim_today)}
            >
              {isClaimingLogin ? (
                <>
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  {dailyCheckInButtonClaiming}
                </>
              ) : loginStreakInfo && !loginStreakInfo.can_claim_today ? (
                <>
                  <CheckCircle className="w-5 h-5 mr-2" />
                  {dailyCheckInButtonDone}
                </>
              ) : (
                <>
                  <Calendar className="w-5 h-5 mr-2" />
                  {dailyCheckInButtonAction}
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Watch Ad Card */}
        <Card className="bg-gradient-accent shadow-glow">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-accent-foreground/20 flex items-center justify-center">
                  <Video className="w-6 h-6 text-accent-foreground" />
                </div>
                <div className="text-accent-foreground">
                  <h3 className="font-bold text-lg">{watchAdTitle}</h3>
                  <p className="text-sm opacity-90">{watchAdSubtitle}</p>
                </div>
              </div>
              <div className="text-right text-accent-foreground">
                <div className="text-2xl font-bold flex items-center gap-1">
                  <Coins className="w-6 h-6" />
                  {watchAdReward}
                </div>
              </div>
            </div>
            <Button
              variant="secondary"
              size="lg"
              className="w-full"
              onClick={handleWatchAd}
              disabled={isWatchingAd}
            >
              {isWatchingAd ? (
                <>
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  {watchAdLoading}
                </>
              ) : (
                <>
                  <Video className="w-5 h-5 mr-2" />
                  {watchAdButton}
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Missions */}
        <div className="space-y-3">
          <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
            <Gift className="w-5 h-5 text-primary" />
            {missionsSectionTitle}
          </h2>

          {localizedMissions.map((mission) => {
            const missionProgress = getMissionProgress(mission.id);
            const progressPercentage = Math.round(missionProgress.progress);
            const isCompleted = missionProgress.completed;
            const isClaimed = isRewardClaimed(mission.id);
            const isClaiming = claimingMissionId === mission.id;
            
            // 調試日誌
            console.log(`🎯 Mission ${mission.id} (${mission.name}):`, {
              progress: progressPercentage,
              completed: isCompleted,
              claimed: isClaimed,
              userMissions: userMissions,
              stats: {
                totalVotes: stats.totalVotes,
                uniqueTopicVotes: stats.uniqueTopicVotes,
                topicsCreated: stats.topicsCreated
              }
            });
            
            // 如果已領取，顯示已領取狀態
            // 如果未領取但已完成條件，顯示領取按鈕
            // 如果未完成，顯示進度條
            
            return (
              <Card
                key={mission.id}
                className={`shadow-card hover:shadow-glow transition-all ${
                  isClaimed ? "opacity-75" : ""
                }`}
              >
                <CardContent className="p-5">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-bold text-foreground">{mission.name}</h3>
                        {isClaimed && (
                          <CheckCircle className="w-5 h-5 text-primary" />
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground mb-2">
                        {mission.description}
                      </p>
                      <Badge variant="secondary" className="text-xs">
                        {mission.condition}
                      </Badge>
                    </div>
                    
                    <div className="flex flex-col items-end gap-1 ml-4">
                      <div className="flex items-center gap-1 text-accent font-bold text-lg">
                        <Coins className="w-5 h-5" />
                        {mission.reward}
                      </div>
                      {!isCompleted && !isClaimed && (
                        <Badge variant="outline" className="text-xs">
                          <Clock className="w-3 h-3 mr-1" />
                          {missionInProgress}
                        </Badge>
                      )}
                    </div>
                  </div>

                  {/* 未完成且未領取：顯示進度條 */}
                  {!isCompleted && !isClaimed && (
                    <div className="space-y-1">
                      <Progress value={progressPercentage} className="h-2" />
                      <div className="text-xs text-muted-foreground text-right">
                        {missionProgressTemplate.replace('{{percent}}', progressPercentage.toString())}
                      </div>
                    </div>
                  )}

                  {/* 已完成但未領取：顯示領取按鈕 */}
                  {isCompleted && !isClaimed && (
                    <div className="mt-3">
                      <Button 
                        variant="default" 
                        size="sm" 
                        className="w-full"
                        onClick={() => handleClaimReward(mission.id)}
                        disabled={isClaiming || loadingMissions}
                      >
                        {isClaiming ? (
                          <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            {missionClaiming}
                          </>
                        ) : (
                          <>
                            <Gift className="w-4 h-4 mr-2" />
                            {missionClaimButton}
                          </>
                        )}
                      </Button>
                    </div>
                  )}

                  {/* 已領取：顯示已領取狀態 */}
                  {isClaimed && (
                    <div className="mt-3">
                      <Button variant="secondary" size="sm" className="w-full" disabled>
                        <CheckCircle className="w-4 h-4 mr-2" />
                        {missionClaimed}
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>

        <Card className="bg-muted/50 border-muted">
          <CardContent className="p-4">
            <h3 className="font-semibold text-foreground mb-2">{infoCardTitle}</h3>
            <ul className="space-y-1 text-sm text-muted-foreground">
              {infoCardItems.map((item, index) => (
                <li key={index}>{item}</li>
              ))}
            </ul>
          </CardContent>
        </Card>

        <Card className="bg-primary/5 border-primary/20">
          <CardContent className="p-4">
            <h3 className="font-semibold text-foreground mb-2">{mobileNoteTitle}</h3>
            <p className="text-sm text-muted-foreground">
              {mobileNoteDescription}
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default MissionPage;
