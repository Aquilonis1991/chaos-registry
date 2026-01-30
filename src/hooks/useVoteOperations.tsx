import { useCallback } from 'react';
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useProfile } from "@/hooks/useProfile";
import { useUIText } from "@/hooks/useUIText";
import { useLanguage } from "@/contexts/LanguageContext";

const stringifyError = (error: any) => {
  if (!error) return "undefined";
  try {
    return JSON.stringify(error, Object.getOwnPropertyNames(error), 2);
  } catch {
    return String(error);
  }
};

export const useVoteOperations = () => {
  const { updateTokensOptimistically, refreshProfile } = useProfile();
  const { language } = useLanguage();
  const { getText } = useUIText(language);

  const castVote = useCallback(async (topicId: string, option: string, amount: number) => {
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

      // 先進行樂觀更新，立即反映在 UI 上（在投票操作之前）
      updateTokensOptimistically(-amount);

      // 獲取主題標題與選項用於記錄 (移到前面以便生成描述)
      const { data: topic } = await supabase
        .from('topics')
        .select('title, options')
        .eq('id', topicId)
        .single();

      // 解析選項文字
      let optionLabel = option;
      if (topic?.options && Array.isArray(topic.options) && topic.options.length > 0) {
        const foundOption = topic.options.find((opt: any) => {
          if (!opt) return false;
          return (opt.id === option) || (opt.id === undefined && opt === option);
        });
        if (foundOption) {
          if (typeof foundOption === 'string') {
            optionLabel = foundOption;
          } else if (foundOption && typeof foundOption === 'object') {
            // Fix TS error: Property 'text' does not exist on type 'Json[]'
            const optObj = foundOption as any;
            optionLabel = optObj.text || optObj.label || option;
          }
        }
      }

      const description = `投票：${topic?.title || '未知主題'} - 選項：${optionLabel}`;

      try {
        // 使用原子化 RPC 進行投票 (包含扣款、記錄、更新)
        // Fix TS error: Argument of type '"cast_vote_atomic"' is not assignable
        const { data, error: rpcError } = await (supabase.rpc as any)('cast_vote_atomic', {
          p_topic_id: topicId,
          p_option_id: option,
          p_vote_amount: amount,
          p_description: description
        });

        if (rpcError) {
          // 對常見錯誤進行處理
          if (rpcError.message?.includes('Topic not found')) {
            throw new Error('主題不存在');
          } else if (rpcError.message?.includes('Topic has ended')) {
            throw new Error('投票已結束');
          } else if (rpcError.message?.includes('Option not found')) {
            throw new Error('選項不存在');
          } else if (rpcError.message?.includes('Insufficient tokens')) {
            throw new Error('代幣不足');
          }
          throw rpcError;
        }

        // 成功後，後台刷新以確保數據最新
        void refreshProfile();

        // 記錄日誌 (僅供調試)
        console.log('✅ Vote cast successfully via atomic RPC:', {
          topicId,
          amount,
          option: optionLabel
        });

      } catch (error) {
        // 如果失敗，回滾樂觀更新
        updateTokensOptimistically(amount);
        throw error;
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
        // Show the actual error message for debugging
        toast.error(`投票失敗: ${error.message || '未知錯誤'}`);
      }
      throw error;
    }
  }, [updateTokensOptimistically, refreshProfile, getText]);

  const castFreeVote = useCallback(async (topicId: string, option: string) => {
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
      // Fix TS error: Argument of type '"increment_free_vote"' is not assignable
      const { error: functionErr } = await (supabase.rpc as any)('increment_free_vote', {
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

      // 獲取主題標題用於記錄 (修正: 也要獲取 options 以解析選項名稱)
      const { data: topic } = await supabase
        .from('topics')
        .select('title, options')
        .eq('id', topicId)
        .single();

      // 解析選項文字（改進：添加更嚴格的 null 檢查）
      let optionLabel = option;
      if (topic?.options && Array.isArray(topic.options) && topic.options.length > 0) {
        const foundOption = topic.options.find((opt: any) => {
          if (!opt) return false; // 確保 opt 不是 null/undefined
          return (opt.id === option) || (opt.id === undefined && opt === option);
        });
        if (foundOption) {
          if (typeof foundOption === 'string') {
            optionLabel = foundOption;
          } else if (foundOption && typeof foundOption === 'object') {
            // Fix TS error
            const optObj = foundOption as any;
            optionLabel = optObj.text || optObj.label || option;
          }
        }
      }

      // 確保免費投票記錄到 token_transactions
      // 修正：現在由後端 increment_free_vote 函數自動記錄，前端無需重複調用
      // 這避免了「投票成功但記錄失敗」的雙重步驟風險
      // (Atomic Transaction handled by RPC)
      console.log('✅ Free vote cast and recorded atomically by RPC');

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
        // Show the actual error message for debugging
        toast.error(`免費票投票失敗: ${error.message || '未知錯誤'}`);
      }
      throw error;
    }
  }, [getText]);

  const checkFreeVoteAvailable = useCallback(async (topicId: string): Promise<boolean> => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return false;

      // 檢查今日是否已使用免費票 (使用 UTC 時間，與資料庫一致)
      const startOfDay = new Date().toISOString().split('T')[0] + 'T00:00:00.000Z';

      // Fix TS error: Argument of type '"free_votes"' is not assignable
      const { data, error } = await (supabase.from as any)('free_votes')
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
  }, []);

  return { castVote, castFreeVote, checkFreeVoteAvailable };
};
