import { useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { AdMobService, watchRewardedAd } from "@/lib/admob";
import { useSystemConfigCache } from "@/hooks/useSystemConfigCache";
import { useLanguage } from "@/contexts/LanguageContext";
import { useUIText } from "@/hooks/useUIText";
import { useServerTime } from "@/contexts/ServerTimeContext";

interface DailyLoginInfo {
  isNewLogin: boolean;
  currentStreak: number;
  totalDays: number;
  rewardTokens: number;
  lastLoginDate: string;
  canClaimToday: boolean;
  streakRewardAvailable: boolean;
}

export const useMissionOperations = () => {
  const { getConfig } = useSystemConfigCache();
  const { language } = useLanguage();
  const { getText } = useUIText(language);
  const { getNow, getNowMs } = useServerTime();

  const completeMission = async (missionId: string) => {
    // 直接使用 RPC（更快更可靠，避免 CORS 問題）
    // Edge Function 在移動端容易出現 CORS 問題，RPC 更穩定
    return await completeMissionFallback(missionId);
  };

  const completeMissionFallback = async (missionId: string) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('未登入');

    // 檢查用戶是否被限制完成任務（異步執行，不阻塞主流程）
    // 如果限制檢查失敗，RPC 函數內部也會處理
    const restrictionCheckPromise = import("@/lib/userRestrictions").then(({ checkUserRestriction }) =>
      checkUserRestriction(user.id, 'complete_mission')
    ).catch(() => ({ restricted: false }));

    // 使用安全的數據庫函數來完成任務（原子性操作，防止競態條件）
    // 改進：使用 AbortController 來取消請求，而不是讓 Promise 繼續執行
    const abortController = new AbortController();
    const timeoutId = setTimeout(() => {
      abortController.abort();
    }, 10000); // 10秒超時

    let rpcResult: { data: any; error: any };
    try {
      // 注意：Supabase RPC 目前不直接支援 AbortController
      // 但我們可以使用 Promise.race，並在超時後記錄警告
      // 暱稱任務：不在改名時直接發獎；由任務頁點擊領取時發獎（且不可重複）。
      // 允許「可偽造完成」：此 RPC 不驗證 nickname_updated_at。
      const rpcPromise = missionId === 'nickname_editor'
        ? supabase.rpc('complete_nickname_mission_once' as any)
        : supabase.rpc('complete_mission_safe' as any, {
          p_user_id: user.id,
          p_mission_id: missionId
        });

      const timeoutPromise = new Promise<{ data: null; error: { message: string } }>((_, reject) =>
        setTimeout(() => {
          abortController.abort();
          reject(new Error('RPC 調用超時（10秒）'));
        }, 10000)
      );

      rpcResult = await Promise.race([
        rpcPromise,
        timeoutPromise
      ]) as { data: any; error: any };
      
      clearTimeout(timeoutId);
    } catch (timeoutError: any) {
      clearTimeout(timeoutId);
      console.error('[completeMission] RPC 調用超時:', timeoutError);
      throw new Error('完成任務超時，請檢查網絡連接或稍後再試');
    }

    const { data: result, error: rpcError } = rpcResult;

    // 檢查限制（如果 RPC 還沒完成，等待一下）
    const restriction = await Promise.race([
      restrictionCheckPromise,
      new Promise<{ restricted: boolean }>((resolve) => setTimeout(() => resolve({ restricted: false }), 1000))
    ]);

    if (restriction.restricted) {
      const restrictionReason =
        typeof (restriction as any)?.reason === 'string' ? (restriction as any).reason : undefined;
      const restrictedMsg = restrictionReason || getText('mission.complete.restricted', '完成任務功能已被暫停');
      toast.error(restrictedMsg);
      throw new Error(restrictedMsg);
    }

    if (rpcError) {
      console.error('Complete mission RPC error:', rpcError);
      throw new Error(rpcError.message || '完成任務失敗');
    }

    if (!result || result.length === 0) {
      throw new Error('完成任務失敗：無返回結果');
    }

    const missionResult = result[0];

    if (!missionResult.success) {
      const errorMsg = missionResult.error_message || getText('mission.complete.failed', '完成任務失敗');
      if (errorMsg.includes('已完成')) {
        toast.error(getText('mission.complete.alreadyCompleted', '任務已完成'));
      } else if (errorMsg.includes('已達上限')) {
        toast.error(getText('mission.complete.dailyLimitReached', '今日任務次數已達上限'));
      } else {
        toast.error(errorMsg);
      }
      throw new Error(errorMsg);
    }

    return { success: true, reward: missionResult.reward };
  };

  const watchAd = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('未登入');

      // 檢查用戶是否被限制完成任務
      const { checkUserRestriction } = await import("@/lib/userRestrictions");
      const restriction = await checkUserRestriction(user.id, 'complete_mission');
      if (restriction.restricted) {
        const restrictedMsg = restriction.reason || getText('mission.complete.restricted', '完成任務功能已被暫停');
        toast.error(restrictedMsg);
        throw new Error(restrictedMsg);
      }

      // 1) 先檢查每日限制（在觀看廣告之前）
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('tokens, ad_watch_count, last_login')
        .eq('id', user.id)
        .single();
      if (profileError || !profile) throw new Error('找不到用戶資料');

      // 從後台配置讀取觀看廣告限制和獎勵
      const maxAdsPerDayRaw = getConfig('mission_watch_ad_limit', 10);
      const adRewardRaw = getConfig('mission_watch_ad_reward', 5);

      const MAX_ADS_PER_DAY = typeof maxAdsPerDayRaw === 'number' ? maxAdsPerDayRaw : Number(maxAdsPerDayRaw) || 10;
      const AD_REWARD = typeof adRewardRaw === 'number' ? adRewardRaw : Number(adRewardRaw) || 5;

      // 以「今日」watch_ad 交易筆數為準，避免 profile.ad_watch_count + last_login 被每日簽到等更新導致誤判已達上限
      const now = getNow();
      const startOfTodayUTC = new Date(Date.UTC(
        now.getUTCFullYear(),
        now.getUTCMonth(),
        now.getUTCDate()
      )).toISOString();
      const { count: todayWatchCount, error: countError } = await supabase
        .from('token_transactions')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('transaction_type', 'watch_ad')
        .gte('created_at', startOfTodayUTC);
      if (countError) {
        console.warn('[watchAd] Failed to get today watch count, fallback to profile', countError);
      }
      const adWatchCount = todayWatchCount ?? 0;

      // 在觀看廣告之前檢查限制
      if (adWatchCount >= MAX_ADS_PER_DAY) {
        const limitMsg = getText('mission.watchAd.limitReached', '今日觀看廣告次數已達上限');
        const limitDesc = getText('mission.watchAd.limitReachedDesc', '最多可觀看 {{limit}} 次')
          .replace('{{limit}}', String(MAX_ADS_PER_DAY));
        // 使用特殊的錯誤訊息標記，避免在 catch 中重複顯示
        const limitError = new Error('DAILY_AD_WATCH_LIMIT_REACHED');
        (limitError as any).limitReached = true;
        (limitError as any).limit = MAX_ADS_PER_DAY;
        (limitError as any).limitMsg = limitMsg;
        (limitError as any).limitDesc = limitDesc;
        toast.error(limitMsg, { description: limitDesc });
        throw limitError;
      }

      // 2) 確認未達限制後，才觀看廣告
      // 從系統配置讀取 AdMob 點擊觀看廣告單元 ID（支持 Android/iOS 分別配置）
      const rewardedAdUnitIdConfig = getConfig('admob_rewarded_ad_unit_id', '');
      // 配置可能是字符串（舊格式）或對象（新格式：{android: "...", ios: "..."}）
      const rewardedAdUnitId = rewardedAdUnitIdConfig || undefined;
      await new Promise<void>((resolve, reject) =>
        watchRewardedAd(
          resolve,
          (err) => reject(new Error(err || '廣告未完成')),
          rewardedAdUnitId // getAdId 函數會自動處理平台區分
        )
      );

      // 3) 嘗試使用 Edge Function（更可靠），如果失敗則使用 RPC

      let tokenUpdateSuccess = false;
      let usedEdgeFunction = false;

      // 優先使用 Edge Function（它會處理所有邏輯：代幣、觀看次數、交易記錄）
      try {
        const edgeStartTime = getNowMs();

        // 為 Edge Function 調用添加超時（20秒），給足夠時間處理
        // 如果 Edge Function 太慢，會自動回退到 RPC
        const edgeFunctionPromise = supabase.functions.invoke('watch-ad', {
          body: {}
        });

        const timeoutPromise = new Promise<{ data: null; error: { message: string } }>((_, reject) =>
          setTimeout(() => reject(new Error('Edge Function 調用超時（20秒）')), 20000)
        );

        let edgeResult: { data: any; error: any };
        try {
          edgeResult = await Promise.race([
            edgeFunctionPromise,
            timeoutPromise
          ]) as { data: any; error: any };
        } catch (timeoutError: any) {
          console.warn('[watchAd] Edge Function 調用超時（20秒），將使用 RPC 備選方案');
          throw new Error('Edge Function 調用超時，將嘗試使用 RPC 備選方案');
        }

        const { data: edgeData, error: edgeError } = edgeResult;
        const edgeDuration = getNowMs() - edgeStartTime;

        if (!edgeError && edgeData?.success) {
          tokenUpdateSuccess = true;
          usedEdgeFunction = true;
          // Edge Function 成功後立即返回，不等待後續操作
          const remainingAds = MAX_ADS_PER_DAY - (adWatchCount + 1);
          return {
            success: true,
            reward: AD_REWARD,
            tokens_earned: AD_REWARD,
            remaining_ads: remainingAds,
            usedEdgeFunction: true
          };
        } else {
          console.warn('[watchAd] Edge Function 失敗（耗時 ' + edgeDuration + 'ms），嘗試 RPC:', edgeError || edgeData);
          throw new Error('Edge Function failed');
        }
      } catch (edgeError: any) {
        // 安全修正：這裡原本會在 Edge Function 失敗時，直接呼叫 add_tokens RPC 當備選方案。
        // add_tokens 已收回 authenticated 執行權限（該函式先前對任何已登入用戶開放，等同
        // 任何人都能直接呼叫幫自己灌任意數量代幣），watch-ad Edge Function 內部已改用
        // service role 呼叫 add_tokens，故這裡不再繞過 Edge Function 直接發代幣，
        // 失敗時單純把錯誤往外拋，讓使用者知道要重試。
        console.error('[watchAd] ❌ Edge Function 失敗，且已移除不安全的 RPC 備選方案:', edgeError);
        throw new Error(
          getText('mission.watchAd.edgeFunctionFailed', '發放獎勵失敗，請檢查網路連線後再試一次')
        );
      }

      if (!tokenUpdateSuccess) {
        throw new Error('無法增加代幣：所有方法都失敗了');
      }

      // 移除耗時的驗證步驟，因為 RPC 已經成功執行了
      // 代幣已經在數據庫中增加，不需要再次查詢驗證
      const remainingAds = MAX_ADS_PER_DAY - (adWatchCount + 1);

      // 注意：toast 訊息將在 MissionPage 中顯示，這裡不顯示以避免重複
      return {
        success: true,
        reward: AD_REWARD,
        tokens_earned: AD_REWARD,
        remaining_ads: remainingAds,
        usedEdgeFunction: false
      };
    } catch (error: any) {
      console.error('Watch ad error:', error);

      // 如果已經顯示過限制錯誤，不再重複顯示
      if (error.limitReached) {
        // 錯誤訊息已經在限制檢查時顯示過了，直接拋出錯誤
        throw error;
      }

      // 處理其他錯誤
      if (error.message?.includes('Daily ad watch limit') || error.message?.includes('已達上限')) {
        const limitMsg = getText('mission.watchAd.limitReached', '今日觀看廣告次數已達上限');
        toast.error(limitMsg);
      } else if (error.message?.includes('未登入')) {
        toast.error(getText('mission.watchAd.notLoggedIn', '請先登入'));
      } else if (error.message?.includes('廣告未完成')) {
        toast.error(getText('mission.watchAd.notCompleted', '廣告未完整觀看'));
      } else if (error.message?.includes('超時') || error.message?.includes('timeout')) {
        // 網絡超時錯誤，提供更詳細的提示
        toast.error(getText('mission.networkTimeout.title', '網路連線超時'), {
          description: getText('mission.networkTimeout.desc', '請檢查網路連線，或稍後再試。如果問題持續，請聯繫客服。')
        });
      } else {
        toast.error(getText('mission.watchAd.failed', '觀看廣告失敗'), {
          description: error.message || getText('mission.watchAd.failedDescDefault', '請稍後再試或聯繫客服')
        });
      }
      throw error;
    }
  };

  const claimDailyLogin = async (): Promise<DailyLoginInfo | null> => {
    console.log('[claimDailyLogin] Function called');
    try {
      console.log('[claimDailyLogin] Getting user...');
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        console.error('[claimDailyLogin] No user found');
        throw new Error('未登入');
      }
      console.log('[claimDailyLogin] User found:', user.id);

      // 檢查用戶是否被限制完成任務
      const { checkUserRestriction } = await import("@/lib/userRestrictions");
      const restriction = await checkUserRestriction(user.id, 'complete_mission');
      if (restriction.restricted) {
        const restrictedMsg = restriction.reason || getText('mission.complete.restricted', '完成任務功能已被暫停');
        toast.error(restrictedMsg);
        throw new Error(restrictedMsg);
      }

      console.log('[claimDailyLogin] Calling record_daily_login RPC for user:', user.id);
      const { data: result, error } = await supabase.rpc('record_daily_login' as any, {
        p_user_id: user.id
      });

      console.log('[claimDailyLogin] RPC response:', { result, error });

      if (error) {
        console.error('[claimDailyLogin] RPC error:', error);
        throw error;
      }

      if (!result || !Array.isArray(result) || result.length === 0) {
        console.error('[claimDailyLogin] No result returned from RPC');
        throw new Error('登入記錄失敗');
      }

      const loginResult = result[0] as any;
      console.log('[claimDailyLogin] Login result:', {
        is_new_login: loginResult.is_new_login,
        current_streak: loginResult.current_streak,
        total_days: loginResult.total_days,
        reward_tokens: loginResult.reward_tokens
      });
      const today = getNow();
      const todayDate = today.toISOString().split('T')[0];

      // 從 get_login_streak_info 獲取最新的 can_claim_today 狀態
      // 如果 record_daily_login 返回 is_new_login = false，表示已經簽到過
      // 需要重新查詢 get_login_streak_info 來獲取正確的 can_claim_today 狀態
      let canClaimToday = false;
      if (loginResult.is_new_login) {
        // 如果是新登入，簽到後不能再簽到
        canClaimToday = false;
      } else {
        // 如果不是新登入，查詢最新的狀態
        try {
          const { data: streakResult, error: streakError } = await supabase.rpc('get_login_streak_info' as any, {
            p_user_id: user.id
          });
          if (!streakError && streakResult && Array.isArray(streakResult) && streakResult.length > 0) {
            canClaimToday = (streakResult[0] as any).can_claim_today ?? false;
          } else {
            console.warn('[claimDailyLogin] Failed to get streak info:', streakError);
            canClaimToday = false;
          }
        } catch (error) {
          console.warn('[claimDailyLogin] Failed to get streak info, using default', error);
          // 如果查詢失敗，根據 last_login_date 判斷
          // 如果 lastLoginDate 是今天，則不能簽到
          canClaimToday = false;
        }
      }

      const loginInfo: DailyLoginInfo = {
        isNewLogin: loginResult.is_new_login,
        currentStreak: loginResult.current_streak || 0,
        totalDays: loginResult.total_days || 0,
        rewardTokens: loginResult.reward_tokens || 0,
        lastLoginDate: todayDate,
        canClaimToday: canClaimToday,
        streakRewardAvailable: (loginResult.current_streak || 0) >= 4 && (loginResult.current_streak || 0) < 5,
      };

      if (!loginInfo.isNewLogin) {
        console.log('[claimDailyLogin] Not a new login, user already claimed today');
        const streakDescTemplate = getText('mission.dailyLogin.streakDescTemplate', '當前連續登入 {{days}} 天');
        toast.info(getText('mission.dailyLogin.alreadyClaimed', '今日已簽到'), {
          description: streakDescTemplate.replace('{{days}}', String(loginInfo.currentStreak))
        });
        return loginInfo;
      }

      // 新登入獎勵
      console.log('[claimDailyLogin] New login successful, reward tokens:', loginInfo.rewardTokens);

      // 驗證代幣是否真的被發放（查詢最新的 profile）
      try {
        const { data: profileData, error: profileError } = await supabase
          .from('profiles')
          .select('tokens')
          .eq('id', user.id)
          .single();

        if (!profileError && profileData) {
          console.log('[claimDailyLogin] Current token balance after login:', profileData.tokens);
          if (loginInfo.rewardTokens > 0 && profileData.tokens !== undefined) {
            console.log('[claimDailyLogin] Token balance verified');
          } else {
            console.warn('[claimDailyLogin] Warning: Reward tokens is 0 or token balance is undefined');
          }
        } else {
          console.warn('[claimDailyLogin] Failed to verify token balance:', profileError);
        }
      } catch (verifyError) {
        console.warn('[claimDailyLogin] Error verifying token balance:', verifyError);
      }

      const loginSuccessMsg = getText('mission.dailyLogin.success', '簽到成功！獲得 {{amount}} 失序值')
        .replace('{{amount}}', loginInfo.rewardTokens.toLocaleString());
      const successDescTemplate = getText('mission.dailyLogin.successDescTemplate', '連續登入 {{days}} 天');
      toast.success(loginSuccessMsg, {
        description: successDescTemplate.replace('{{days}}', String(loginInfo.currentStreak))
      });

      return loginInfo;
    } catch (error: any) {
      console.error('[claimDailyLogin] Error caught:', error);
      console.error('[claimDailyLogin] Error details:', {
        message: error?.message,
        stack: error?.stack,
        name: error?.name,
        code: error?.code,
        details: error?.details,
        hint: error?.hint
      });

      if (error.message?.includes('未登入')) {
        toast.error(getText('mission.dailyLogin.notLoggedIn', '請先登入'));
      } else {
        const errorMsg = error?.message || getText('mission.dailyLogin.failed', '簽到失敗');
        toast.error(errorMsg);
      }

      throw error;
    }
  };

  const getLoginStreakInfo = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;

      const { data: result, error } = await supabase.rpc('get_login_streak_info' as any, {
        p_user_id: user.id
      });

      if (error) throw error;

      return result?.[0] || null;
    } catch (error) {
      console.error('Get login streak error:', error);
      return null;
    }
  }, []);

  return { completeMission, watchAd, claimDailyLogin, getLoginStreakInfo };
};
