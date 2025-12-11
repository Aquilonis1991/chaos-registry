import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { AdMobService, watchRewardedAd } from "@/lib/admob";
import { useSystemConfigCache } from "@/hooks/useSystemConfigCache";
import { useLanguage } from "@/contexts/LanguageContext";
import { useUIText } from "@/hooks/useUIText";

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
  const { getConfig, configCache } = useSystemConfigCache();
  const { language } = useLanguage();
  const { getText } = useUIText(language);
  
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
    // 添加超時處理（10秒）
    const rpcPromise = supabase.rpc('complete_mission_safe', {
      p_user_id: user.id,
      p_mission_id: missionId
    });

    const timeoutPromise = new Promise<{ data: null; error: { message: string } }>((_, reject) => 
      setTimeout(() => reject(new Error('RPC 調用超時（10秒）')), 10000)
    );

    let rpcResult: { data: any; error: any };
    try {
      rpcResult = await Promise.race([
        rpcPromise,
        timeoutPromise
      ]) as { data: any; error: any };
    } catch (timeoutError: any) {
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
      const restrictedMsg = restriction.reason || getText('mission.complete.restricted', '完成任務功能已被暫停');
      toast.error(restrictedMsg);
      throw new Error(restrictedMsg);
    }

    if (rpcError) {
      console.error('Complete mission RPC error:', rpcError);
      throw new Error('完成任務失敗');
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
      // 注意：不需要每次都刷新配置，緩存已經足夠新（配置更新頻率低）
      // 只在首次加載時會自動獲取配置，之後使用緩存即可
      
      // 優先使用 mission_watch_ad_limit（實際使用的鍵名），如果不存在則嘗試 max_ads_per_day
      const maxAdsPerDayRaw = getConfig('mission_watch_ad_limit', getConfig('max_ads_per_day', 10));
      // 優先讀取 mission_watch_ad_reward，如果不存在才讀取 ad_reward_amount
      const adRewardRaw = getConfig('mission_watch_ad_reward', getConfig('ad_reward_amount', 5));
      
      // 確保轉換為數字
      const MAX_ADS_PER_DAY = typeof maxAdsPerDayRaw === 'number' ? maxAdsPerDayRaw : Number(maxAdsPerDayRaw) || 10;
      const AD_REWARD = typeof adRewardRaw === 'number' ? adRewardRaw : Number(adRewardRaw) || 5;
      
      const today = new Date().toISOString().split('T')[0];
      const lastLogin = profile.last_login ? new Date(profile.last_login).toISOString().split('T')[0] : null;
      let adWatchCount = profile.ad_watch_count || 0;
      if (lastLogin !== today) adWatchCount = 0;
      
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
        const edgeStartTime = Date.now();
        
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
        const edgeDuration = Date.now() - edgeStartTime;

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
        // Edge Function 失敗，使用 RPC + 手動更新作為備選
        try {
          const rpcStartTime = Date.now();
          
          // 調用 RPC（添加超時處理，15秒，給足夠時間處理）
          const rpcPromise = supabase.rpc('add_tokens', {
            user_id: user.id,
            token_amount: AD_REWARD
          });
          
          const timeoutPromise = new Promise<{ data: null; error: { message: string } }>((_, reject) => 
            setTimeout(() => reject(new Error('RPC 調用超時（15秒）')), 15000)
          );
          
          let rpcResult: { data: any; error: any };
          try {
            rpcResult = await Promise.race([
              rpcPromise,
              timeoutPromise
            ]) as { data: any; error: any };
          } catch (timeoutError: any) {
            console.error('[watchAd] ❌ RPC 調用超時:', timeoutError);
            // RPC 超時，直接拋出錯誤（不嘗試備選方案，因為 add_tokens_from_ad_watch 可能不存在或參數不匹配）
            throw new Error('RPC 調用超時，請檢查網絡連接或稍後再試');
          }
          
          const { data: rpcData, error: tokenError } = rpcResult;
          
          const rpcDuration = Date.now() - rpcStartTime;

          if (tokenError) {
            console.error('[watchAd] ❌ Add tokens RPC error:', {
              error: tokenError,
              code: tokenError.code,
              message: tokenError.message,
              details: tokenError.details,
              hint: tokenError.hint
            });
            throw new Error('增加代幣失敗：' + (tokenError.message || '未知錯誤'));
          }


          // RPC 調用成功後，立即標記為成功（不等待後續操作）
          tokenUpdateSuccess = true;

          // 後續操作改為異步執行，不阻塞 UI
          Promise.allSettled([
            // 更新觀看次數和登入時間
            supabase.from('profiles')
        .update({
          ad_watch_count: adWatchCount + 1,
          last_login: new Date().toISOString()
        })
              .eq('id', user.id)
          ]).catch(() => {
            // 靜默處理錯誤，不影響主流程
          });
        } catch (rpcError: any) {
          console.error('[watchAd] ❌ RPC 備選方案失敗:', {
            error: rpcError,
            message: rpcError?.message,
            stack: rpcError?.stack
          });
          throw rpcError;
        }
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
        toast.error('網絡連接超時', {
          description: '請檢查網絡連接，或稍後再試。如果問題持續，請聯繫客服。'
        });
      } else {
        toast.error(getText('mission.watchAd.failed', '觀看廣告失敗'), {
          description: error.message || '請稍後再試或聯繫客服'
        });
      }
      throw error;
    }
  };

  const claimDailyLogin = async (): Promise<DailyLoginInfo | null> => {
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
      const today = new Date();
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
        toast.info(getText('mission.dailyLogin.alreadyClaimed', '今日已簽到'), {
          description: `當前連續登入 ${loginInfo.currentStreak} 天`
        });
        return loginInfo;
      }

      // 新登入獎勵
      console.log('[claimDailyLogin] New login successful, reward tokens:', loginInfo.rewardTokens);
      const loginSuccessMsg = getText('mission.dailyLogin.success', '簽到成功！獲得 {{amount}} 代幣')
        .replace('{{amount}}', loginInfo.rewardTokens.toLocaleString());
      toast.success(loginSuccessMsg, {
        description: `連續登入 ${loginInfo.currentStreak} 天`
      });

      return loginInfo;
    } catch (error: any) {
      console.error('Daily login error:', error);
      
      if (error.message?.includes('未登入')) {
        toast.error(getText('mission.dailyLogin.notLoggedIn', '請先登入'));
      } else {
        toast.error(getText('mission.dailyLogin.failed', '簽到失敗'));
      }
      
      throw error;
    }
  };

  const getLoginStreakInfo = async () => {
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
  };

  return { completeMission, watchAd, claimDailyLogin, getLoginStreakInfo };
};
