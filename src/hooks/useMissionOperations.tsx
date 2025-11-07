import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { AdMobService, watchRewardedAd } from "@/lib/admob";

export const useMissionOperations = () => {
  const completeMission = async (missionId: string) => {
    try {
      // 嘗試使用 Edge Function
      const { data: result, error } = await supabase.functions.invoke('complete-mission', {
        body: {
          mission_id: missionId
        }
      });

      if (!error && result?.success) {
        return result;
      }

      // 如果 Edge Function 失敗，使用 fallback 機制
      console.warn('Edge Function failed, using fallback:', error);
      return await completeMissionFallback(missionId);
    } catch (error: any) {
      console.error('Complete mission error:', error);
      
      // 如果 Edge Function 拋出錯誤，嘗試 fallback
      if (error.message?.includes('CORS') || error.message?.includes('Failed to fetch') || error.code === 'PGRST301') {
        try {
          return await completeMissionFallback(missionId);
        } catch (fallbackError) {
          console.error('Fallback also failed:', fallbackError);
          throw fallbackError;
        }
      }
      
      if (error.message?.includes('already completed')) {
        toast.error('任務已完成');
      } else if (error.message?.includes('Daily mission limit')) {
        toast.error('今日任務次數已達上限');
      } else {
        toast.error('完成任務失敗');
      }
      
      throw error;
    }
  };

  const completeMissionFallback = async (missionId: string) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('未登入');

    // 檢查用戶是否被限制完成任務
    const { checkUserRestriction } = await import("@/lib/userRestrictions");
    const restriction = await checkUserRestriction(user.id, 'complete_mission');
    if (restriction.restricted) {
      toast.error(restriction.reason || '完成任務功能已被暫停');
      throw new Error(restriction.reason || '完成任務功能已被暫停');
    }

    // 使用安全的數據庫函數來完成任務（原子性操作，防止競態條件）
    const { data: result, error: rpcError } = await supabase.rpc('complete_mission_safe', {
      p_user_id: user.id,
      p_mission_id: missionId
    });

    if (rpcError) {
      console.error('Complete mission RPC error:', rpcError);
      throw new Error('完成任務失敗');
    }

    if (!result || result.length === 0) {
      throw new Error('完成任務失敗：無返回結果');
    }

    const missionResult = result[0];

    if (!missionResult.success) {
      const errorMsg = missionResult.error_message || '完成任務失敗';
      if (errorMsg.includes('已完成')) {
        toast.error('任務已完成');
      } else if (errorMsg.includes('已達上限')) {
        toast.error('今日任務次數已達上限');
      } else {
        toast.error(errorMsg);
      }
      throw new Error(errorMsg);
    }

    return { success: true, reward: missionResult.reward };
  };

  const watchAd = async () => {
    // Web：先顯示（或模擬）獎勵廣告，完成後才發放代幣
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('未登入');

      // 檢查用戶是否被限制完成任務
      const { checkUserRestriction } = await import("@/lib/userRestrictions");
      const restriction = await checkUserRestriction(user.id, 'complete_mission');
      if (restriction.restricted) {
        toast.error(restriction.reason || '完成任務功能已被暫停');
        throw new Error(restriction.reason || '完成任務功能已被暫停');
      }

      // 1) 先完整觀看（Web 會自動模擬成功）
      await new Promise<void>((resolve, reject) =>
        watchRewardedAd(resolve, (err) => reject(new Error(err || '廣告未完成')))
      );

      // 2) 檢查每日限制
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('tokens, ad_watch_count, last_login')
        .eq('id', user.id)
        .single();
      if (profileError || !profile) throw new Error('找不到用戶資料');

      const MAX_ADS_PER_DAY = 10;
      const AD_REWARD = 5;
      const today = new Date().toISOString().split('T')[0];
      const lastLogin = profile.last_login ? new Date(profile.last_login).toISOString().split('T')[0] : null;
      let adWatchCount = profile.ad_watch_count || 0;
      if (lastLogin !== today) adWatchCount = 0;
      if (adWatchCount >= MAX_ADS_PER_DAY) {
        toast.error('今日觀看廣告次數已達上限', { description: `最多可觀看 ${MAX_ADS_PER_DAY} 次` });
        throw new Error('Daily ad watch limit reached');
      }

      // 3) 直接更新代幣與觀看次數（不呼叫 RPC，避免 404）
      const { error: updateTokensError } = await supabase
        .from('profiles')
        .update({
          tokens: (profile.tokens || 0) + AD_REWARD,
          ad_watch_count: adWatchCount + 1,
          last_login: new Date().toISOString()
        })
        .eq('id', user.id);
      if (updateTokensError) throw updateTokensError;

      const remainingAds = MAX_ADS_PER_DAY - (adWatchCount + 1);
      toast.success(`獲得 ${AD_REWARD.toLocaleString()} 代幣！`, { description: `今日剩餘 ${remainingAds} 次觀看機會` });
      return { success: true, reward: AD_REWARD, tokens_earned: AD_REWARD, remaining_ads: remainingAds };
    } catch (error: any) {
      console.error('Watch ad error:', error);
      if (error.message?.includes('Daily ad watch limit') || error.message?.includes('已達上限')) {
        toast.error('今日觀看廣告次數已達上限');
      } else if (error.message?.includes('未登入')) {
        toast.error('請先登入');
      } else if (error.message?.includes('廣告未完成')) {
        toast.error('廣告未完整觀看');
      } else {
        toast.error('觀看廣告失敗');
      }
      throw error;
    }
  };

  const claimDailyLogin = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('未登入');

      // 檢查用戶是否被限制完成任務
      const { checkUserRestriction } = await import("@/lib/userRestrictions");
      const restriction = await checkUserRestriction(user.id, 'complete_mission');
      if (restriction.restricted) {
        toast.error(restriction.reason || '完成任務功能已被暫停');
        throw new Error(restriction.reason || '完成任務功能已被暫停');
      }

      const { data: result, error } = await supabase.rpc('record_daily_login', {
        p_user_id: user.id
      });

      if (error) throw error;

      if (!result || result.length === 0) {
        throw new Error('登入記錄失敗');
      }

      const loginResult = result[0];

      if (!loginResult.is_new_login) {
        toast.info('今日已簽到', {
          description: `當前連續登入 ${loginResult.current_streak} 天`
        });
        return loginResult;
      }

      // 新登入獎勵
      toast.success(`簽到成功！獲得 ${loginResult.reward_tokens.toLocaleString()} 代幣`, {
        description: `連續登入 ${loginResult.current_streak} 天`
      });

      // 如果達到 5 天連續登入
      if (loginResult.current_streak === 5) {
        toast.success('🎉 連續登入5天達成！', {
          description: '獲得免費發起主題資格'
        });
      }

      return loginResult;
    } catch (error: any) {
      console.error('Daily login error:', error);
      
      if (error.message?.includes('未登入')) {
        toast.error('請先登入');
      } else {
        toast.error('簽到失敗');
      }
      
      throw error;
    }
  };

  const getLoginStreakInfo = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;

      const { data: result, error } = await supabase.rpc('get_login_streak_info', {
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
