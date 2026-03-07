import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { devLog } from "@/lib/devLog";

const parseTransactionAmount = (value: number | string | null | undefined): number => {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    const parsed = parseFloat(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
};

export interface UserStats {
  totalVotes: number;
  totalFreeVotes: number;
  topicsCreated: number;
  tokensSpent: number;
  tokensEarned: number;
  joinedDate: string;
  lastActive: string;
  uniqueTopicVotes: number; // 投票過的不同主題數量
}

export const useUserStats = (userId: string | undefined) => {
  const [stats, setStats] = useState<UserStats>({
    totalVotes: 0,
    totalFreeVotes: 0,
    topicsCreated: 0,
    tokensSpent: 0,
    tokensEarned: 0,
    joinedDate: '',
    lastActive: '',
    uniqueTopicVotes: 0,
  });
  const [loading, setLoading] = useState(true);

  const fetchUserStats = useCallback(async () => {
    if (!userId) return;

    try {
      setLoading(true);

      // 並行執行所有數據庫查詢
      const [
        votesResult,
        freeVotesResult,
        topicsResult,
        transactionsResult,
        profileResult
      ] = await Promise.all([
        // 1. 獲取代幣投票記錄
        supabase
          .from('votes')
          .select('topic_id, amount')
          .eq('user_id', userId),

        // 2. 獲取免費投票記錄
        (supabase.from as any)('free_votes')
          .select('topic_id')
          .eq('user_id', userId),

        // 3. 獲取創建的主題數量
        supabase
          .from('topics')
          .select('*', { count: 'exact', head: true })
          .eq('creator_id', userId),

        // 4. 獲取交易記錄
        supabase
          .from('token_transactions')
          .select('id, amount, transaction_type')
          .eq('user_id', userId),

        // 5. 獲取用戶資料
        supabase
          .from('profiles')
          .select('created_at, last_login')
          .eq('id', userId)
          .single()
      ]);

      const { data: votesData, error: votesError } = votesResult;
      const { data: freeVotesData, error: freeVotesError } = freeVotesResult;
      const { count: topicsCount, error: topicsError } = topicsResult;
      const { data: allTransactions, error: transError } = transactionsResult;
      const { data: profile, error: profileError } = profileResult;

      // 處理投票數據
      if (votesError) {
        console.warn('⚠️ Error fetching votes:', votesError);
      } else {
        devLog('✅ Votes fetched:', votesData?.length || 0, 'votes');
        if (votesData && votesData.length > 0) {
          devLog('📋 Vote topic IDs:', votesData.map((v: any) => v.topic_id));
        }
      }

      // 處理免費投票數據
      if (freeVotesError) {
        console.warn('⚠️ Error fetching free votes:', freeVotesError);
      } else {
        devLog('✅ Free votes fetched:', freeVotesData?.length || 0, 'free votes');
        if (freeVotesData && freeVotesData.length > 0) {
          devLog('📋 Free vote topic IDs:', freeVotesData.map((v: any) => v.topic_id));
        }
      }

      const freeVoteCount = freeVotesData?.length || 0;
      devLog('📊 Free vote count:', freeVoteCount);

      // 從 votes 表計算代幣投票次數（僅作為診斷用途）
      let tokenVoteCountFromVotes = 0;
      if (votesData && votesData.length > 0) {
        const votesWithAmount = votesData.filter((v: any) => v.amount && v.amount > 0);
        tokenVoteCountFromVotes = votesWithAmount.reduce((sum: number, v: any) => {
          const amount = typeof v.amount === 'number' ? v.amount : parseFloat(String(v.amount)) || 0;
          return sum + amount;
        }, 0);
        devLog('📊 Token vote count from votes table (diagnostic only):', {
          totalVotes: votesData.length,
          votesWithAmount: votesWithAmount.length,
          tokenVoteCount: tokenVoteCountFromVotes
        });
      }

      // 計算投票過的不同主題數量
      const voteTopicIds = new Set([
        ...(votesData?.map((v: any) => v.topic_id) || []),
        ...(freeVotesData?.map((v: any) => v.topic_id) || [])
      ]);
      const uniqueTopicVotesCount = voteTopicIds.size;
      devLog('📊 Unique topic votes:', uniqueTopicVotesCount, 'topics:', Array.from(voteTopicIds));

      // 處理主題數量錯誤
      if (topicsError) {
        console.warn('Error fetching topics count:', topicsError);
      } else {
        devLog('✅ Topics created:', topicsCount || 0);
      }

      // 計算代幣使用統計
      let tokensSpent = 0;
      let tokensEarned = 0;
      let tokenVoteCountFromTransactions = 0;

      if (transError) {
        console.warn('⚠️ Error fetching token_transactions:', transError);
        // 如果失敗，退回到使用 votes 表的數據（雖然不準確，但比 0 好）
        // 但為了保持邏輯一致，這裡保持 0，並依賴上方的診斷日誌
      } else {
        const voteTransactions = allTransactions?.filter(
          (t: any) => t.transaction_type === 'cast_vote'
        );

        devLog('🔍 Token transactions for votes:', {
          totalTransactions: allTransactions?.length || 0,
          voteTransactions: voteTransactions?.length || 0,
          voteTransactionsData: voteTransactions?.map((t: any) => ({
            id: t.id || 'unknown',
            amount: t.amount,
            type: t.transaction_type
          }))
        });

        tokenVoteCountFromTransactions = voteTransactions?.reduce((sum: number, t: any) => {
          const amountValue = parseTransactionAmount(t.amount);
          const absAmount = Math.abs(amountValue);
          devLog('🔍 Processing vote transaction:', {
            amount: t.amount,
            parsedAmount: amountValue,
            absAmount: absAmount,
            sum: sum + absAmount
          });
          return sum + absAmount;
        }, 0) || 0;

        devLog('✅ Calculated tokenVoteCount from transactions:', tokenVoteCountFromTransactions);

        tokensSpent = allTransactions
          ?.filter((t: any) => parseTransactionAmount(t.amount) < 0)
          .reduce((sum: number, t: any) => {
            const amountValue = parseTransactionAmount(t.amount);
            return sum + Math.abs(amountValue);
          }, 0) || 0;

        tokensEarned = allTransactions
          ?.filter((t: any) => parseTransactionAmount(t.amount) > 0)
          .reduce((sum: number, t: any) => {
            const amountValue = parseTransactionAmount(t.amount);
            return sum + amountValue;
          }, 0) || 0;
      }

      const tokenVoteCount = tokenVoteCountFromTransactions;

      if (tokenVoteCount === 0 && tokenVoteCountFromVotes > 0) {
        console.warn('⚠️ Token transactions missing but votes table shows spending.', {
          diagnosticVotesAmount: tokenVoteCountFromVotes
        });
      }

      // 處理用戶資料
      let joinedDate = '';
      let lastActive = '';

      if (profileError) {
        console.warn('⚠️ Error fetching profile:', profileError);
      } else {
        joinedDate = profile?.created_at || '';
        lastActive = profile?.last_login || '';
      }

      const totalVotes = tokenVoteCount + freeVoteCount;
      console.log('📊 Total votes calculated:', {
        totalVotes,
        tokenVotes: tokenVoteCount,
        freeVotes: freeVoteCount,
        breakdown: {
          fromTransactions: tokenVoteCountFromTransactions,
          diagnosticVotes: tokenVoteCountFromVotes,
          freeVoteCount
        }
      });

      // 構建最終統計數據
      const finalStats = {
        totalVotes: totalVotes,
        totalFreeVotes: freeVoteCount,
        topicsCreated: topicsCount || 0,
        tokensSpent,
        tokensEarned,
        joinedDate,
        lastActive,
        uniqueTopicVotes: uniqueTopicVotesCount,
      };

      devLog('📊 Final User Stats:', finalStats);
      setStats(finalStats);
    } catch (error) {
      console.error('❌ Critical error fetching user stats:', error);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    if (!userId) {
      setLoading(false);
      return;
    }

    fetchUserStats();
  }, [userId, fetchUserStats]);

  const refreshStats = useCallback(() => {
    fetchUserStats();
  }, [fetchUserStats]);

  return {
    stats,
    loading,
    refreshStats,
  };
};

