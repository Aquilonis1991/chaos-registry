import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

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

  useEffect(() => {
    if (!userId) {
      setLoading(false);
      return;
    }

    fetchUserStats();
  }, [userId]);

  const fetchUserStats = async () => {
    if (!userId) return;

    try {
      setLoading(true);

      // 獲取代幣投票記錄（從 votes 表）
      const { data: votesData, error: votesError } = await supabase
        .from('votes')
        .select('topic_id')
        .eq('user_id', userId);

      if (votesError) {
        console.warn('⚠️ Error fetching votes:', votesError);
        // 不拋出錯誤，繼續執行
      } else {
        console.log('✅ Votes fetched:', votesData?.length || 0, 'votes');
        if (votesData && votesData.length > 0) {
          console.log('📋 Vote topic IDs:', votesData.map(v => v.topic_id));
        }
      }

      // 獲取免費投票記錄（從 free_votes 表）
      const { data: freeVotesData, error: freeVotesError } = await supabase
        .from('free_votes')
        .select('topic_id')
        .eq('user_id', userId);

      if (freeVotesError) {
        console.warn('⚠️ Error fetching free votes:', freeVotesError);
        // 不拋出錯誤，繼續執行
      } else {
        console.log('✅ Free votes fetched:', freeVotesData?.length || 0, 'free votes');
        if (freeVotesData && freeVotesData.length > 0) {
          console.log('📋 Free vote topic IDs:', freeVotesData.map(v => v.topic_id));
        }
      }

      // 計算總投票次數（代幣投票 + 免費投票）
      const totalVotes = (votesData?.length || 0) + (freeVotesData?.length || 0);
      console.log('📊 Total votes calculated:', totalVotes, '(votes:', votesData?.length || 0, '+ free_votes:', freeVotesData?.length || 0, ')');

      // 計算投票過的不同主題數量（用於「投票愛好者」任務）
      const voteTopicIds = new Set([
        ...(votesData?.map(v => v.topic_id) || []),
        ...(freeVotesData?.map(v => v.topic_id) || [])
      ]);
      const uniqueTopicVotesCount = voteTopicIds.size;
      console.log('📊 Unique topic votes:', uniqueTopicVotesCount, 'topics:', Array.from(voteTopicIds));

      // 獲取創建的主題數量
      const { count: topicsCount, error: topicsError } = await supabase
        .from('topics')
        .select('*', { count: 'exact', head: true })
        .eq('creator_id', userId);

      if (topicsError) {
        console.warn('Error fetching topics count:', topicsError);
      } else {
        console.log('✅ Topics created:', topicsCount || 0);
      }

      // 計算代幣使用統計（如果表不存在，使用默認值）
      let tokensSpent = 0;
      let tokensEarned = 0;
      
      try {
        const { data: allTransactions, error: transError } = await supabase
          .from('token_transactions')
          .select('amount, transaction_type')
          .eq('user_id', userId);

        if (transError) {
          console.warn('⚠️ Error fetching token_transactions (table may not exist):', transError);
          // 不拋出錯誤，使用默認值 0
        } else {
          tokensSpent = allTransactions
            ?.filter(t => t.amount < 0)
            .reduce((sum, t) => sum + Math.abs(t.amount), 0) || 0;

          tokensEarned = allTransactions
            ?.filter(t => t.amount > 0)
            .reduce((sum, t) => sum + t.amount, 0) || 0;
        }
      } catch (transError) {
        console.warn('⚠️ Exception fetching token_transactions:', transError);
        // 使用默認值 0
      }

      // 獲取用戶註冊時間
      let joinedDate = '';
      let lastActive = '';
      
      try {
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('created_at, last_login')
          .eq('id', userId)
          .single();

        if (profileError) {
          console.warn('⚠️ Error fetching profile:', profileError);
          // 不拋出錯誤，使用默認值
        } else {
          joinedDate = profile?.created_at || '';
          lastActive = profile?.last_login || '';
        }
      } catch (profileError) {
        console.warn('⚠️ Exception fetching profile:', profileError);
        // 使用默認值
      }

      // 構建最終統計數據（即使部分查詢失敗，也要設置已獲取的數據）
      const finalStats = {
        totalVotes: totalVotes, // 總投票次數（用於「新手上路」任務）
        totalFreeVotes: freeVotesData?.length || 0,
        topicsCreated: topicsCount || 0,
        tokensSpent,
        tokensEarned,
        joinedDate,
        lastActive,
        uniqueTopicVotes: uniqueTopicVotesCount, // 投票過的不同主題數量（用於「投票愛好者」任務）
      };

      console.log('📊 Final User Stats:', finalStats);
      setStats(finalStats);
    } catch (error) {
      console.error('❌ Critical error fetching user stats:', error);
      // 即使發生錯誤，也嘗試設置已獲取的數據（如果有的話）
      // 這裡不設置，因為如果發生關鍵錯誤，我們希望保持初始狀態
    } finally {
      setLoading(false);
    }
  };

  const refreshStats = () => {
    fetchUserStats();
  };

  return {
    stats,
    loading,
    refreshStats,
  };
};

