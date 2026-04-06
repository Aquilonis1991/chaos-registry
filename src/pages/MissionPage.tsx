import { Card, CardContent } from "@/components/ui/card";
import { LoadingBubble } from "@/components/ui/LoadingBubble";
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
import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";
import { useUIText } from "@/hooks/useUIText";
import { useSystemConfigCache } from "@/hooks/useSystemConfigCache";
import { playTokenAmountHaptic } from "@/lib/tokenHaptics";
import { DAILY_SHARE_COPIED_EVENT, hasDailyShareCopiedToday } from "@/lib/dailyShareCopyGate";

// 任務映射：前端任務 ID -> 數據庫任務 ID
const MISSION_ID_MAP: Record<string, string> = {
  "1": "first_vote",      // 新手上路（需要創建）
  "2": "vote_lover",      // 投票愛好者
  "3": "topic_creator",   // 話題創造者
  "5": "nickname_editor", // 修改暱稱
  "6": "daily_vote_1",    // 每日投票 1 票
  "7": "daily_vote_5",    // 每日投票 5 票
  "8": "daily_vote_10",   // 每日投票 10 票
  "9": "streak_7_repeat",   // 連續簽到 7 天（可重複）
  "10": "streak_14_repeat", // 連續簽到 14 天（可重複）
  "11": "streak_30_repeat", // 連續簽到 30 天（可重複）
  "12": "daily_share_1", // 每日口耳相傳（分享）
};

interface LoginStreakInfo {
  current_streak: number;
  total_login_days: number;
  last_login_date: string | null;
  can_claim_today: boolean;
  streak_reward_available: boolean;
}

const getTaipeiDateKey = (date = new Date()): string => {
  const shifted = new Date(date.getTime() + (8 * 60 + date.getTimezoneOffset()) * 60_000);
  return shifted.toISOString().slice(0, 10);
};

const getTaipeiDateKeyFromIso = (iso?: string | null): string | null => {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return getTaipeiDateKey(date);
};

const getStreakCycleStartDateKey = (streak: number): string => {
  const safeStreak = Math.max(1, Math.floor(streak || 1));
  const now = new Date();
  const cycleStart = new Date(now.getTime() - (safeStreak - 1) * 24 * 60 * 60 * 1000);
  return getTaipeiDateKey(cycleStart);
};

const MissionPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { profile, refreshProfile, updateTokensOptimistically } = useProfile();
  const { stats, loading: statsLoading, refreshStats } = useUserStats(user?.id);
  const { watchAd, claimDailyLogin, getLoginStreakInfo, completeMission } = useMissionOperations();
  const { language } = useLanguage();
  const { getText, isLoading: uiTextsLoading } = useUIText(language);
  const { configs, getConfig, refreshConfigs } = useSystemConfigCache();
  const [isWatchingAd, setIsWatchingAd] = useState(false);
  const [isClaimingLogin, setIsClaimingLogin] = useState(false);
  const [loginStreakInfo, setLoginStreakInfo] = useState<LoginStreakInfo | null>(null);
  const [displayedStreak, setDisplayedStreak] = useState(0);
  const [loadingStreak, setLoadingStreak] = useState(true);
  const [userMissions, setUserMissions] = useState<Record<string, { completed: boolean; completed_at: string | null; last_completed_date?: string | null; progress?: number | null }>>({});
  const [loadingMissions, setLoadingMissions] = useState(true);
  const [claimingMissionId, setClaimingMissionId] = useState<string | null>(null);
  const [dailyVoteCount, setDailyVoteCount] = useState(0);
  /** 口耳相傳：使用者按過「複製並分享」後刷新進度（localStorage 無法觸發重繪） */
  const [shareCopyNonce, setShareCopyNonce] = useState(0);
  // 追蹤最近一次顯示的 toast，避免重複顯示
  const lastToastRef = useRef<{ type: string; timestamp: number } | null>(null);

  const userTokens = profile?.tokens || 0;
  const lastStableStreakRef = useRef(0);

  // 提取配置值，避免在 useMemo 中調用函數導致無限循環
  const missionConfigs = useMemo(() => {
    const result = {
      firstVoteReward: configs['mission_first_vote_reward'] ?? 50,
      voteLoverTarget: configs['mission_vote_lover_target'] ?? 10,
      voteLoverReward: configs['mission_vote_lover_reward'] ?? 50,
      createTopicReward: configs['mission_create_topic_reward'] ?? 50,
      login7DaysTarget: configs['mission_7days_login_target'] ?? 7,
      login7DaysReward: configs['mission_7days_login_reward_tokens'] ?? 100,
      nicknameEditReward: configs['mission_nickname_change_reward'] ?? 20,
      watchAdReward: configs['mission_watch_ad_reward'] ?? 5,
      watchAdLimit: configs['mission_watch_ad_limit'] ?? 10,
      dailyLoginReward: configs['mission_daily_login_reward'] ?? 3,
      dailyVote1Reward: configs['mission_daily_vote_1_reward'] ?? 3,
      dailyVote5Reward: configs['mission_daily_vote_5_reward'] ?? 5,
      dailyVote10Reward: configs['mission_daily_vote_10_reward'] ?? 10,
      streak7RepeatReward: configs['mission_streak_7_reward'] ?? 80,
      streak14RepeatReward: configs['mission_streak_14_reward'] ?? 200,
      streak30RepeatReward: configs['mission_streak_30_reward'] ?? 500,
      dailyShareReward: configs['mission_daily_share_reward'] ?? 10,
    };

    return result;
  }, [configs]);

  const localizedMissions = useMemo(() => {
    // 從後台配置讀取任務參數 (使用與 SQL Patch 一致的默認值)
    const firstVoteReward = typeof missionConfigs.firstVoteReward === 'number'
      ? missionConfigs.firstVoteReward
      : Number(missionConfigs.firstVoteReward) || 50;

    const voteLoverTarget = typeof missionConfigs.voteLoverTarget === 'number'
      ? missionConfigs.voteLoverTarget
      : Number(missionConfigs.voteLoverTarget) || 10;
    const voteLoverReward = typeof missionConfigs.voteLoverReward === 'number'
      ? missionConfigs.voteLoverReward
      : Number(missionConfigs.voteLoverReward) || 50;

    const createTopicReward = typeof missionConfigs.createTopicReward === 'number'
      ? missionConfigs.createTopicReward
      : Number(missionConfigs.createTopicReward) || 50;

    const login7DaysTarget = typeof missionConfigs.login7DaysTarget === 'number'
      ? missionConfigs.login7DaysTarget
      : Number(missionConfigs.login7DaysTarget) || 7;
    const login7DaysReward = typeof missionConfigs.login7DaysReward === 'number'
      ? missionConfigs.login7DaysReward
      : Number(missionConfigs.login7DaysReward) || 100;
    const nicknameEditReward = typeof missionConfigs.nicknameEditReward === 'number'
      ? missionConfigs.nicknameEditReward
      : Number(missionConfigs.nicknameEditReward) || 20;
    const dailyVote1Reward = typeof missionConfigs.dailyVote1Reward === 'number'
      ? missionConfigs.dailyVote1Reward
      : Number(missionConfigs.dailyVote1Reward) || 3;
    const dailyVote5Reward = typeof missionConfigs.dailyVote5Reward === 'number'
      ? missionConfigs.dailyVote5Reward
      : Number(missionConfigs.dailyVote5Reward) || 5;
    const dailyVote10Reward = typeof missionConfigs.dailyVote10Reward === 'number'
      ? missionConfigs.dailyVote10Reward
      : Number(missionConfigs.dailyVote10Reward) || 10;
    const streak7RepeatReward = typeof missionConfigs.streak7RepeatReward === 'number'
      ? missionConfigs.streak7RepeatReward
      : Number(missionConfigs.streak7RepeatReward) || 80;
    const streak14RepeatReward = typeof missionConfigs.streak14RepeatReward === 'number'
      ? missionConfigs.streak14RepeatReward
      : Number(missionConfigs.streak14RepeatReward) || 200;
    const streak30RepeatReward = typeof missionConfigs.streak30RepeatReward === 'number'
      ? missionConfigs.streak30RepeatReward
      : Number(missionConfigs.streak30RepeatReward) || 500;
    const dailyShareReward = typeof missionConfigs.dailyShareReward === 'number'
      ? missionConfigs.dailyShareReward
      : Number(missionConfigs.dailyShareReward) || 10;

    const templates = [
      // === 每日任務 ===
      {
        id: "6",
        name: "每日投票（1票）",
        description: "今日累積投票 1 票",
        condition: "今日投票 1 票",
        reward: dailyVote1Reward,
        target: 1,
      },
      {
        id: "7",
        name: "每日投票（5票）",
        description: "今日累積投票 5 票",
        condition: "今日投票 5 票",
        reward: dailyVote5Reward,
        target: 5,
      },
      {
        id: "8",
        name: "每日投票（10票）",
        description: "今日累積投票 10 票",
        condition: "今日投票 10 票",
        reward: dailyVote10Reward,
        target: 10,
      },
      {
        id: "12",
        name: "每日口耳相傳",
        description: "使用分享功能複製文案後，前往任務頁領取每日獎勵（每日一次）",
        condition: "於任務頁領取分享獎勵 1 次",
        reward: dailyShareReward,
        target: 1,
      },
      // === 可重複完成簽到 ===
      {
        id: "9",
        name: "連續簽到 7 天",
        description: "當前連續簽到達 7 天（可重複）",
        condition: "連續簽到 7 天",
        reward: streak7RepeatReward,
        target: 7,
      },
      {
        id: "10",
        name: "連續簽到 14 天",
        description: "當前連續簽到達 14 天（可重複）",
        condition: "連續簽到 14 天",
        reward: streak14RepeatReward,
        target: 14,
      },
      {
        id: "11",
        name: "連續簽到 30 天",
        description: "當前連續簽到達 30 天（可重複）",
        condition: "連續簽到 30 天",
        reward: streak30RepeatReward,
        target: 30,
      },
      // === 單次任務 ===
      {
        id: "1",
        name: "新手上路",
        description: "完成第一次投票", // 這裡的文字會再次通過 getText 翻譯
        condition: "投票 1 次",
        reward: firstVoteReward,
        target: 1, // 用於進度計算
      },
      {
        id: "2",
        name: "投票愛好者",
        description: `對 ${voteLoverTarget} 個不同主題進行投票`,
        condition: `投票 ${voteLoverTarget} 次`,
        reward: voteLoverReward,
        target: voteLoverTarget,
      },
      {
        id: "3",
        name: "話題創造者",
        description: "發起一個主題",
        condition: "發起主題 1 次",
        reward: createTopicReward,
        target: 1,
      },
      {
        id: "5",
        name: "形象更新",
        description: "成功修改一次暱稱",
        condition: "修改暱稱 1 次",
        reward: nicknameEditReward,
        target: 1,
      },
    ];

    return templates.map((mission) => ({
      ...mission,
      name: getText(`mission.list.${mission.id}.name`, mission.name),
      // 支援動態參數替換：如果 getText 返回的字串包含 {{target}} 佔位符，則進行替換
      // 同時保留 defaults 中的動態數值
      description: getText(`mission.list.${mission.id}.description`, mission.description)
        .replace('{{target}}', String(mission.target)),
      condition: getText(`mission.list.${mission.id}.condition`, mission.condition)
        .replace('{{target}}', String(mission.target)),
    }));
  }, [getText, language, missionConfigs]);

  // 修改：getMissionProgress 需要依賴 localizedMissions 裡面的 target
  const getMissionProgress = useCallback((missionId: string): { progress: number; completed: boolean } => {
    if (statsLoading) {
      return { progress: 0, completed: false };
    }

    const dbMissionId = MISSION_ID_MAP[missionId];
    const isClaimed = dbMissionId ? userMissions[dbMissionId]?.completed === true : false;
    const markedProgress = dbMissionId ? (userMissions[dbMissionId]?.progress ?? 0) : 0;

    // 獲取該任務的目標值 (從 localizedMissions 查找)
    const missionTemplate = localizedMissions.find(m => m.id === missionId);
    const target = missionTemplate?.target || 1; // 默認為 1 防呆

    // 如果已領取，任務視為已完成（即使統計數據為 0）
    if (isClaimed) {
      return { progress: 100, completed: true };
    }

    switch (missionId) {
      case "1": // 新手上路
        const voteProgress = stats.totalVotes > 0 ? 100 : 0;
        return {
          progress: voteProgress,
          completed: stats.totalVotes > 0
        };
      case "2": // 投票愛好者
        const uniqueTopics = stats.uniqueTopicVotes || 0;
        const uniqueProgress = Math.min((uniqueTopics / target) * 100, 100);
        return {
          progress: uniqueProgress,
          completed: uniqueTopics >= target
        };
      case "3": // 話題創造者
        const topicProgress = stats.topicsCreated > 0 ? 100 : 0;
        return {
          progress: topicProgress,
          completed: stats.topicsCreated > 0
        };
      case "5": // 修改暱稱
        return {
          progress: (profile?.nickname_updated_at || markedProgress >= 100) ? 100 : 0,
          completed: Boolean(profile?.nickname_updated_at) || markedProgress >= 100
        };
      case "6":
      case "7":
      case "8":
        return {
          progress: Math.min((dailyVoteCount / target) * 100, 100),
          completed: dailyVoteCount >= target
        };
      case "9":
      case "10":
      case "11": {
        const streakSafe = Math.max(0, displayedStreak || 0);
        const cycleDay = streakSafe > 0 ? ((streakSafe - 1) % 30) + 1 : 0;
        return {
          progress: Math.min((cycleDay / target) * 100, 100),
          completed: cycleDay >= target
        };
      }
      case "12": {
        const copiedToday = Boolean(user?.id) && hasDailyShareCopiedToday(user.id);
        return {
          progress: copiedToday ? 100 : 0,
          completed: copiedToday
        };
      }
      default:
        return { progress: 0, completed: false };
    }
  }, [statsLoading, stats, userMissions, localizedMissions, displayedStreak, profile?.nickname_updated_at, dailyVoteCount, user?.id, shareCopyNonce]);

  const applyLoginStreakInfo = useCallback((info: LoginStreakInfo | null) => {
    setLoginStreakInfo(info);

    if (!info) {
      lastStableStreakRef.current = 0;
      setDisplayedStreak(0);
      return;
    }

    const nextStreak = info.current_streak ?? 0;
    if (nextStreak > 0) {
      lastStableStreakRef.current = nextStreak;
      setDisplayedStreak(nextStreak);
      return;
    }

    if (lastStableStreakRef.current > 0 && info.can_claim_today) {
      setDisplayedStreak(lastStableStreakRef.current);
      return;
    }

    lastStableStreakRef.current = nextStreak;
    setDisplayedStreak(nextStreak);
  }, []);

  const loadLoginStreak = useCallback(async (options: { showLoader?: boolean } = {}) => {
    const { showLoader = true } = options;
    if (showLoader) {
      setLoadingStreak(true);
    }
    try {
      const info = await getLoginStreakInfo();
      applyLoginStreakInfo(info);
    } catch (error) {
      console.error('Error loading login streak:', error);
    } finally {
      if (showLoader) {
        setLoadingStreak(false);
      }
    }
  }, [getLoginStreakInfo, applyLoginStreakInfo]);

  const loadDailyVoteCount = useCallback(async () => {
    if (!user?.id) {
      setDailyVoteCount(0);
      return;
    }
    try {
      const now = new Date();
      const taipeiNow = new Date(now.getTime() + (8 * 60 + now.getTimezoneOffset()) * 60_000);
      const startTaipei = new Date(taipeiNow.getFullYear(), taipeiNow.getMonth(), taipeiNow.getDate(), 0, 0, 0, 0);
      const endTaipei = new Date(taipeiNow.getFullYear(), taipeiNow.getMonth(), taipeiNow.getDate(), 23, 59, 59, 999);
      const startUtcIso = new Date(startTaipei.getTime() - 8 * 60 * 60_000).toISOString();
      const endUtcIso = new Date(endTaipei.getTime() - 8 * 60 * 60_000).toISOString();

      const [votesRes, freeVotesRes] = await Promise.all([
        supabase
          .from('votes')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', user.id)
          .gte('created_at', startUtcIso)
          .lte('created_at', endUtcIso),
        supabase
          .from('free_votes')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', user.id)
          .gte('used_at', startUtcIso)
          .lte('used_at', endUtcIso),
      ]);
      if (votesRes.error) throw votesRes.error;
      if (freeVotesRes.error) throw freeVotesRes.error;
      setDailyVoteCount((votesRes.count ?? 0) + (freeVotesRes.count ?? 0));
    } catch (e) {
      console.error('Error loading daily vote count:', e);
      setDailyVoteCount(0);
    }
  }, [user?.id]);

  // 載入登入連勝資訊
  useEffect(() => {
    loadLoginStreak();
  }, [loadLoginStreak]);

  const loadUserMissions = useCallback(async () => {
    if (!user?.id) {
      setLoadingMissions(false);
      return;
    }

    try {
      setLoadingMissions(true);
      const { data, error } = await supabase
        .from('user_missions')
        .select('mission_id, completed, completed_at, last_completed_date, progress')
        .eq('user_id', user.id);

      if (error) throw error;

      const missionsMap: Record<string, { completed: boolean; completed_at: string | null; last_completed_date?: string | null; progress?: number | null }> = {};
      data?.forEach((mission) => {
        missionsMap[mission.mission_id] = {
          completed: mission.completed,
          completed_at: mission.completed_at,
          last_completed_date: (mission as any).last_completed_date ?? null,
          progress: (mission as any).progress ?? null,
        };
      });

      setUserMissions(missionsMap);
    } catch (error) {
      console.error('Error loading user missions:', error);
    } finally {
      setLoadingMissions(false);
    }
  }, [user?.id]);

  const handleWatchAd = async () => {
    if (isWatchingAd) return;

    setIsWatchingAd(true);
    let optimisticUpdateApplied = false;
    try {
      // 使用 missionConfigs 中的配置值，確保與顯示的獎勵一致
      const AD_REWARD = typeof missionConfigs.watchAdReward === 'number'
        ? missionConfigs.watchAdReward
        : Number(missionConfigs.watchAdReward) || 5;

      // 先觀看廣告，只有在廣告觀看成功後才進行樂觀更新
      // 這樣可以避免：如果用戶關閉廣告，代幣不會錯誤增加
      const result = await watchAd();

      // 廣告觀看成功後，立即樂觀更新代幣數量
      // 這確保了只有在用戶真正完成廣告觀看後，UI 才會更新
      updateTokensOptimistically(AD_REWARD);
      void playTokenAmountHaptic(AD_REWARD, 'gain');
      optimisticUpdateApplied = true;

      const adRewardAmount = (result.reward ?? 0).toLocaleString();

      // 防止重複顯示 toast（3秒內不重複顯示相同類型的 toast）
      const now = Date.now();
      const lastToast = lastToastRef.current;
      if (!lastToast || lastToast.type !== 'watchAd' || (now - lastToast.timestamp) > 3000) {
        toast.success(watchAdSuccessTitle, {
          description: watchAdSuccessDescTemplate.replace('{{amount}}', adRewardAmount)
        });
        lastToastRef.current = { type: 'watchAd', timestamp: now };
      }

      // 注意：實時訂閱會在數據庫更新時自動同步，可能會覆蓋樂觀更新
      // 這是正常的，因為實時訂閱的數據是權威來源
      // 如果實時訂閱沒有及時觸發（網絡延遲），樂觀更新會提供即時反饋
    } catch (error) {
      // 如果出錯且已經進行了樂觀更新，需要回滾
      if (optimisticUpdateApplied) {
        const AD_REWARD = typeof missionConfigs.watchAdReward === 'number'
          ? missionConfigs.watchAdReward
          : Number(missionConfigs.watchAdReward) || 5;
        updateTokensOptimistically(-AD_REWARD);
      }
      // Error handled in useMissionOperations
    } finally {
      // 確保按鈕狀態被重置
      setIsWatchingAd(false);
    }
  };

  const handleDailyLogin = async () => {
    // 防止重複點擊
    if (isClaimingLogin) {
      console.log('[MissionPage] handleDailyLogin: Already claiming, ignoring');
      return;
    }

    // 檢查是否已簽到（前端防護）
    if (loginStreakInfo && !loginStreakInfo.can_claim_today) {
      console.log('[MissionPage] handleDailyLogin: Already claimed today, ignoring');
      toast.info(getText('mission.dailyLogin.alreadyClaimed', '今日已簽到'), {
        description: getText('mission.dailyLogin.noMoreReward', '今日已簽到，不再發放失序值')
      });
      return;
    }

    // 只用帳號（後端）狀態判斷，避免任何本地/裝置時間差
    const latestInfo = await getLoginStreakInfo();
    applyLoginStreakInfo(latestInfo);
    if (latestInfo && !latestInfo.can_claim_today) {
      console.log('[MissionPage] handleDailyLogin: Server says already claimed today, ignoring');
      toast.info(getText('mission.dailyLogin.alreadyClaimed', '今日已簽到'), {
        description: getText('mission.dailyLogin.noMoreReward', '今日已簽到，不再發放失序值')
      });
      return;
    }

    console.log('[MissionPage] handleDailyLogin: Starting daily login claim');
    setIsClaimingLogin(true);

    try {
      console.log('[MissionPage] handleDailyLogin: Calling claimDailyLogin...');
      const loginInfo = await claimDailyLogin();
      console.log('[MissionPage] handleDailyLogin: Claim result', loginInfo);

      if (loginInfo) {
        // 無論是新登入還是重複登入，只要返回了 info，就表示今天已處理過
        // 強制更新 UI 狀態為 "今日不可再領取"
        const normalizedInfo: LoginStreakInfo = {
          current_streak: loginInfo.currentStreak,
          total_login_days: loginInfo.totalDays,
          last_login_date: loginInfo.lastLoginDate,
          can_claim_today: false, // 核心修正：簽到後強制設為 false
          streak_reward_available: loginInfo.streakRewardAvailable,
        };
        applyLoginStreakInfo(normalizedInfo);

        // 如果成功簽到 (新登入)，立即更新 UI 狀態
        if (loginInfo.isNewLogin) {
          console.log('[MissionPage] handleDailyLogin: New login successful, reward tokens:', loginInfo.rewardTokens);
          void playTokenAmountHaptic(loginInfo.rewardTokens || 0, 'gain');

          // 移除樂觀更新，直接等待 refreshProfile 同步真實餘額
          // updateTokensOptimistically(loginInfo.rewardTokens || 3);

          await Promise.allSettled([
            refreshProfile(),
            loadUserMissions(),
            loadLoginStreak({ showLoader: false }),
            refreshStats(),
          ]);
        }
      }
    } catch (error: any) {
      console.error('[MissionPage] handleDailyLogin: Error caught', error);
      // ... error handling ...
      // 出錯時才重新載入狀態，確認是否真的失敗
      void loadLoginStreak({ showLoader: false });
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

    if (claimingMissionId) return; // Basic lock

    // 防止重複點擊（前端防護）
    if (claimingMissionId === missionId) return;

    // 檢查是否已領取（額外的前端檢查）
    if (isRewardClaimed(missionId)) {
      toast.info(missionAlreadyClaimedInfo);
      return;
    }

    if (missionId === "12") {
      if (!user?.id) {
        toast.error(getText("mission.dailyShare.needLogin", "請先登入"));
        return;
      }
      if (!hasDailyShareCopiedToday(user.id)) {
        toast.info(
          getText(
            "mission.dailyShare.needCopyFirst",
            "請先到話題頁開啟分享，並按「複製並分享」後再回到此頁領取"
          )
        );
        return;
      }
    }

    setClaimingMissionId(missionId);
    let optimisticUpdateApplied = false;
    try {
      const expectedReward = localizedMissions.find(m => m.id === missionId)?.reward || 0;

      // 先進行樂觀更新，立即更新 UI
      updateTokensOptimistically(expectedReward);
      optimisticUpdateApplied = true;

      const result = await completeMission(dbMissionId);
      if (result?.success) {
        const rewardAmount = result.reward || expectedReward;

        // 如果實際獎勵與預期不同，調整樂觀更新
        if (rewardAmount !== expectedReward) {
          updateTokensOptimistically(-expectedReward + rewardAmount);
        }

        const claimDesc = claimSuccessDescTemplate.replace('{{amount}}', rewardAmount.toLocaleString());
        toast.success(claimSuccessTitle, {
          description: claimDesc
        });
        void playTokenAmountHaptic(rewardAmount, 'gain');

        // 異步刷新失序值餘額和任務狀態（不阻塞 UI）
        Promise.allSettled([
          refreshProfile(),
          loadUserMissions(),
          loadDailyVoteCount(),
          refreshStats()
        ]).catch(() => {
          // 靜默處理錯誤，不影響用戶體驗
        });
      } else {
        // 如果失敗，回滾樂觀更新
        if (optimisticUpdateApplied) {
          updateTokensOptimistically(-expectedReward);
        }
      }
    } catch (error: any) {
      console.error('Claim reward error:', error);

      // 如果出錯且已進行樂觀更新，需要回滾
      if (optimisticUpdateApplied) {
        const expectedReward = localizedMissions.find(m => m.id === missionId)?.reward || 0;
        updateTokensOptimistically(-expectedReward);
      }

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
    const record = userMissions[dbMissionId];
    if (!record?.completed) return false;
    const todayKey = getTaipeiDateKey();
    const lastDone = record.last_completed_date || null;
    const completedAtKey = getTaipeiDateKeyFromIso(record.completed_at);

    // 每日投票任務：只判斷今天是否已領
    if (dbMissionId === 'daily_vote_1' || dbMissionId === 'daily_vote_5' || dbMissionId === 'daily_vote_10') {
      return (lastDone ?? completedAtKey) === todayKey;
    }

    if (dbMissionId === 'daily_share_1') {
      return (lastDone ?? completedAtKey) === todayKey;
    }

    // 連續簽到可重複任務：同一輪 30 天循環內僅可領一次
    if (dbMissionId === 'streak_7_repeat' || dbMissionId === 'streak_14_repeat' || dbMissionId === 'streak_30_repeat') {
      const streak = Math.max(0, displayedStreak || 0);
      if (streak <= 0) return false;
      const cycleDay = ((streak - 1) % 30) + 1;
      const now = new Date();
      // currentCycleStart 為當前 30 天循環的第一天
      const currentCycleStart = new Date(now.getTime() - (cycleDay - 1) * 24 * 60 * 60 * 1000);
      const currentCycleStartStr = getTaipeiDateKey(currentCycleStart);
      const streakDoneDate = lastDone ?? completedAtKey;
      return Boolean(streakDoneDate && streakDoneDate >= currentCycleStartStr);
    }

    if (!lastDone && !completedAtKey) return false;
    return true;
  };

  // 載入用戶任務完成狀態
  useEffect(() => {
    loadUserMissions();
    loadDailyVoteCount();
  }, [loadUserMissions, loadDailyVoteCount]);

  // 當頁面聚焦時也刷新任務狀態
  useEffect(() => {
    const handleFocus = () => {
      if (user?.id) {
        loadUserMissions();
        loadDailyVoteCount();
      }
    };

    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [user?.id, loadUserMissions, loadDailyVoteCount]);

  // 口耳相傳：複製分享成功後，立即刷新此頁顯示狀態
  useEffect(() => {
    const onCopied = () => setShareCopyNonce((n) => n + 1);
    window.addEventListener(DAILY_SHARE_COPIED_EVENT, onCopied);
    return () => window.removeEventListener(DAILY_SHARE_COPIED_EVENT, onCopied);
  }, []);

  // 當頁面聚焦時刷新統計和簽到狀態（確保數據是最新的）
  useEffect(() => {
    const handleFocus = () => {
      if (user?.id) {
        refreshStats();
        loadLoginStreak({ showLoader: false });
        loadDailyVoteCount();
      }
    };

    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [user?.id, refreshStats, loadLoginStreak, loadDailyVoteCount]);

  if (uiTextsLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const headerTitle = getText('mission.header.title', '任務與獎勵');
  const headerSubtitle = getText('mission.header.subtitle', '完成任務賺失序值');
  const dailyCheckInTitle = getText('mission.daily.title', '每日簽到');
  const dailyCheckInLoading = getText('mission.daily.loading', '載入中...');
  const dailyCheckInPending = getText('mission.daily.pending', '今日還未簽到');
  const dailyCheckInCompleted = getText('mission.daily.completed', '今日已簽到');
  const dailyCheckInButtonClaiming = getText('mission.daily.button.claiming', '簽到中...');
  const dailyCheckInButtonDone = getText('mission.daily.button.done', '今日已簽到');
  const dailyCheckInButtonAction = getText('mission.daily.button.action', '立即簽到');
  // 依據後台配置與今日是否可領取，顯示正確獎勵（避免「已簽到仍顯示 +3」造成誤解）
  // 從 missionConfigs 讀取每日登入獎勵，確保與後台配置一致
  const dailyLoginRewardAmount = typeof missionConfigs.dailyLoginReward === 'number'
    ? missionConfigs.dailyLoginReward
    : Number(missionConfigs.dailyLoginReward) || 3;
  const dailyCheckInReward =
    (loginStreakInfo?.can_claim_today === false)
      ? '+0'
      : `+${dailyLoginRewardAmount}`;
  const watchAdTitle = getText('mission.ad.title', '觀看廣告');
  const watchAdSubtitle = getText('mission.ad.subtitle', '輕鬆賺取失序值');

  // 從 missionConfigs 讀取觀看廣告獎勵，確保與後台配置一致
  // 直接使用配置值顯示，不通過 ui_texts，因為獎勵數量應該從 system_config 讀取
  const watchAdRewardAmount = typeof missionConfigs.watchAdReward === 'number'
    ? missionConfigs.watchAdReward
    : Number(missionConfigs.watchAdReward) || 5;
  const watchAdReward = `+${watchAdRewardAmount}`;

  const watchAdLoading = getText('mission.ad.loading', '載入中...');
  const watchAdButton = getText('mission.ad.button', '觀看 30 秒廣告');
  const missionsSectionTitle = getText('mission.list.title', '任務列表');
  const missionInProgress = getText('mission.list.inProgress', '進行中');
  const missionProgressTemplate = getText('mission.list.progress', '{{percent}}% 完成');
  const missionClaiming = getText('mission.list.claiming', '領取中...');
  const missionClaimButton = getText('mission.list.claimButton', '領取獎勵');
  const missionClaimed = getText('mission.list.claimed', '已領取');
  const missionAlreadyClaimedInfo = getText('mission.toast.alreadyClaimed', '任務獎勵已領取');
  const missionIdMissingError = getText('mission.toast.missionMissing', '任務 ID 不存在');
  const claimSuccessTitle = getText('mission.toast.claimSuccess.title', '獎勵領取成功！');
  const claimSuccessDescTemplate = getText('mission.toast.claimSuccess.desc', '獲得 {{amount}} 失序值');
  const claimErrorTitle = getText('mission.toast.claimError.title', '領取獎勵失敗');
  const genericTryAgain = getText('mission.toast.tryAgain', '請稍後再試');
  const watchAdSuccessTitle = getText('mission.toast.watchAdSuccess.title', '觀看廣告完成！');
  const watchAdSuccessDescTemplate = getText('mission.toast.watchAdSuccess.desc', '獲得 {{amount}} 失序值');

  return (
    <div className="min-h-screen bg-background pb-32">
      <LoadingBubble isLoading={isWatchingAd} />
      {/* Header */}
      <header className="sticky top-0 z-40 bg-gradient-primary shadow-lg pt-[calc(0.75rem+env(safe-area-inset-top,0px))]">
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
                    {loadingStreak
                      ? ''
                      : (loginStreakInfo?.can_claim_today === false)
                        ? dailyCheckInCompleted
                        : dailyCheckInPending}
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
              disabled={
                isClaimingLogin ||
                loadingStreak ||
                (loginStreakInfo?.can_claim_today === false)
              }
            >
              {isClaimingLogin ? (
                <>
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  {dailyCheckInButtonClaiming}
                </>
              ) : (loginStreakInfo?.can_claim_today === false) ? (
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

          {localizedMissions.filter(mission => {
            // 連續簽到任務：依序完成才顯示下一個
            if (mission.id === "9" || mission.id === "10" || mission.id === "11") {
              const isClaimed7 = isRewardClaimed("9");
              const isClaimed14 = isRewardClaimed("10");

              let activeStreakMissionId = "9"; // 預設顯示 7 天
              if (isClaimed7 && !isClaimed14) {
                activeStreakMissionId = "10";
              } else if (isClaimed7 && isClaimed14) {
                activeStreakMissionId = "11";
              }

              return mission.id === activeStreakMissionId;
            }
            return true;
          }).map((mission) => {
            const missionProgress = getMissionProgress(mission.id);
            const progressPercentage = Math.round(missionProgress.progress);
            const isCompleted = missionProgress.completed;
            const isClaimed = isRewardClaimed(mission.id);
            const isClaiming = claimingMissionId === mission.id;

            // 如果已領取，顯示已領取狀態
            // 如果未領取但已完成條件，顯示領取按鈕
            // 如果未完成，顯示進度條

            return (
              <Card
                key={mission.id}
                className={`shadow-card hover:shadow-glow transition-all ${isClaimed ? "opacity-75" : ""
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


      </div>
    </div >
  );
};
export default MissionPage;
