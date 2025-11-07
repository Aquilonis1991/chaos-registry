import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const useVoteOperations = () => {
  const castVote = async (topicId: string, option: string, amount: number) => {
    // 直接使用安全的資料庫函數（不使用 Edge Function）
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('未登入');

      // 檢查用戶是否被限制投票
      const { checkUserRestriction } = await import("@/lib/userRestrictions");
      const restriction = await checkUserRestriction(user.id, 'vote');
      if (restriction.restricted) {
        // 不在這裡顯示 toast，讓 catch 區塊統一處理並顯示描述
        throw new Error(restriction.reason || '投票功能已被暫停');
      }

      // 檢查代幣（先檢查，避免無效調用）
      const { data: profile, error: profErr } = await supabase
        .from('profiles')
        .select('tokens')
        .eq('id', user.id)
        .single();
      if (profErr || !profile) throw new Error('找不到用戶資料');
      if ((profile.tokens ?? 0) < amount) {
        toast.error('代幣不足！');
        throw new Error('Insufficient tokens');
      }

      // 使用安全的資料庫函數來更新票數（防止直接操作 options）
      const { error: functionErr } = await supabase.rpc('increment_option_votes', {
        p_topic_id: topicId,
        p_option_id: option,
        p_vote_amount: amount
      });

      if (functionErr) {
        // 函數錯誤可能是因為主題不存在、已結束等
        if (functionErr.message?.includes('Topic not found')) {
          throw new Error('主題不存在');
        } else if (functionErr.message?.includes('Topic has ended')) {
          throw new Error('投票已結束');
        } else if (functionErr.message?.includes('Option not found')) {
          throw new Error('選項不存在');
        }
        throw functionErr;
      }

      // 扣代幣（已通過 RLS 驗證，只能更新自己的）
      const { error: updateTokensErr } = await supabase
        .from('profiles')
        .update({ tokens: (profile.tokens || 0) - amount })
        .eq('id', user.id);
      if (updateTokensErr) throw updateTokensErr;

      // 獲取主題標題用於記錄
      const { data: topic } = await supabase
        .from('topics')
        .select('title')
        .eq('id', topicId)
        .single();

      // 寫入投票紀錄（使用 upsert 處理重複投票的情況）
      try {
        const { error: voteError } = await supabase
          .from('votes')
          .upsert({
            topic_id: topicId,
            user_id: user.id,
            option: option,
            amount,
          }, {
            onConflict: 'user_id,topic_id'
          });
        
        if (voteError) {
          console.warn('寫入 votes 紀錄失敗：', voteError);
        }
      } catch (e) {
        console.warn('寫入 votes 紀錄失敗：', e);
      }

      // 寫入代幣交易記錄
      try {
        const { error: transError } = await supabase
          .from('token_transactions')
          .insert({
            user_id: user.id,
            amount: -amount,
            transaction_type: 'cast_vote',
            reference_id: topicId,
            description: `投票：${topic?.title || '未知主題'} - 選項：${option}`
          });
        
        if (transError) {
          console.warn('寫入 token_transactions 紀錄失敗：', transError);
        }
      } catch (e) {
        console.warn('寫入 token_transactions 紀錄失敗：', e);
      }

      // 添加到 topic_participants（如果不存在）
      try {
        await supabase
          .from('topic_participants')
          .insert({
            user_id: user.id,
            topic_id: topicId
          })
          .select()
          .single()
          .then(({ error }) => {
            // 忽略重複錯誤
            if (error && !error.message?.includes('duplicate')) {
              console.warn('添加到 topic_participants 失敗：', error);
            }
          });
      } catch (e) {
        // 忽略錯誤
      }

      return { success: true } as any;
    } catch (error: any) {
      console.error('Cast vote error:', error);
      
      // 檢查是否因為被限制投票
      if (error.message?.includes('已被暫停') || error.message?.includes('投票功能已被暫停') || error.message?.includes('被禁止')) {
        toast.error('投票失敗', {
          description: error.message || '您的投票功能已被暫停，請聯繫管理員'
        });
      } else if (error.message?.includes('Insufficient tokens') || error.message?.includes('代幣不足')) {
        toast.error('代幣不足！');
      } else if (error.message?.includes('Rate limit')) {
        toast.error('投票太頻繁，請稍後再試');
      } else if (error.message?.includes('Topic not found')) {
        toast.error('主題不存在');
      } else if (error.message?.includes('Topic has ended')) {
        toast.error('投票已結束');
      } else if (error.message?.includes('Option not found')) {
        toast.error('選項不存在');
      } else {
        toast.error('投票失敗');
      }
      throw error;
    }
  };

  const castFreeVote = async (topicId: string, option: string) => {
    // 直接使用安全的資料庫函數（不使用 Edge Function）
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('未登入');

      // 檢查用戶是否被限制投票
      const { checkUserRestriction } = await import("@/lib/userRestrictions");
      const restriction = await checkUserRestriction(user.id, 'vote');
      if (restriction.restricted) {
        // 不在這裡顯示 toast，讓 catch 區塊統一處理並顯示描述
        throw new Error(restriction.reason || '投票功能已被暫停');
      }

      // 使用安全的資料庫函數來處理免費投票（包含所有驗證邏輯）
      const { error: functionErr } = await supabase.rpc('increment_free_vote', {
        p_topic_id: topicId,
        p_option_id: option
      });

      if (functionErr) {
        // 函數已包含所有驗證：主題存在、選項存在、是否已使用免費票等
        if (functionErr.message?.includes('Topic not found')) {
          throw new Error('主題不存在');
        } else if (functionErr.message?.includes('Topic has ended')) {
          throw new Error('投票已結束');
        } else if (functionErr.message?.includes('Free vote already used')) {
          toast.error('今日免費票已使用完畢');
          throw new Error('Free vote already used');
        } else if (functionErr.message?.includes('Option not found')) {
          throw new Error('選項不存在');
        }
        throw functionErr;
      }

      // 獲取主題標題用於記錄
      const { data: topic } = await supabase
        .from('topics')
        .select('title')
        .eq('id', topicId)
        .single();

      // 確保免費投票記錄到 token_transactions（如果函數沒有記錄）
      try {
        const { error: transError } = await supabase
          .from('token_transactions')
          .insert({
            user_id: user.id,
            amount: 0,
            transaction_type: 'free_vote',
            reference_id: topicId,
            description: `免費投票：${topic?.title || '未知主題'} - 選項：${option}`
          });
        
        if (transError && !transError.message?.includes('duplicate')) {
          console.warn('寫入免費投票 token_transactions 紀錄失敗：', transError);
        }
      } catch (e) {
        console.warn('寫入免費投票 token_transactions 紀錄失敗：', e);
      }

      return { success: true } as any;
    } catch (error: any) {
      console.error('Cast free vote error:', error);
      
      // 檢查是否因為被限制投票
      if (error.message?.includes('已被暫停') || error.message?.includes('投票功能已被暫停') || error.message?.includes('被禁止')) {
        toast.error('投票失敗', {
          description: error.message || '您的投票功能已被暫停，請聯繫管理員'
        });
      } else if (error.message?.includes('Free vote already used') || error.message?.includes('今日免費票')) {
        toast.error('今日免費票已使用完畢');
      } else if (error.message?.includes('Topic not found')) {
        toast.error('主題不存在');
      } else if (error.message?.includes('Topic has ended') || error.message?.includes('投票已結束')) {
        toast.error('投票已結束');
      } else if (error.message?.includes('Option not found')) {
        toast.error('選項不存在');
      } else {
        toast.error('免費票投票失敗');
      }
      throw error;
    }
  };

  const checkFreeVoteAvailable = async (topicId: string): Promise<boolean> => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return false;

      // 檢查今日是否已使用免費票
      const today = new Date();
      const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate()).toISOString();
      
      const { data, error } = await supabase
        .from('free_votes')
        .select('id')
        .eq('user_id', user.id)
        .eq('topic_id', topicId)
        .gte('used_at', startOfDay)
        .maybeSingle();

      if (error) {
        console.error('Error checking free vote:', error);
        return false;
      }

      return !data; // Return true if no free vote found for today
    } catch (error) {
      console.error('Error checking free vote:', error);
      return false;
    }
  };

  return { castVote, castFreeVote, checkFreeVoteAvailable };
};
