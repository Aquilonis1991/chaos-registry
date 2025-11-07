import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface VoteHistory {
  id: string;
  topic_id: string;
  topic_title: string;
  option_selected: string;
  tokens_used: number;
  is_free_vote: boolean;
  voted_at: string;
  topic_status: string;
  topic_tags: string[];
}

export const useVoteHistory = (userId: string | undefined) => {
  const [history, setHistory] = useState<VoteHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) {
      setHistory([]);
      setLoading(false);
      return;
    }

    fetchVoteHistory();
  }, [userId]);

  const fetchVoteHistory = async () => {
    if (!userId) return;

    try {
      setLoading(true);
      setError(null);

      // 獲取代幣投票記錄（從 votes 表）
      const { data: votes, error: votesError } = await supabase
        .from('votes')
        .select(`
          id,
          topic_id,
          option,
          amount,
          created_at,
          topics (
            title,
            status,
            tags,
            options
          )
        `)
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (votesError) {
        console.warn('獲取代幣投票記錄失敗：', votesError);
      }

      // 獲取免費投票記錄
      const { data: freeVotes, error: freeVotesError } = await supabase
        .from('free_votes')
        .select(`
          id,
          topic_id,
          option,
          used_at,
          topics (
            title,
            status,
            tags,
            options
          )
        `)
        .eq('user_id', userId)
        .order('used_at', { ascending: false });

      if (freeVotesError) {
        console.warn('獲取免費投票記錄失敗：', freeVotesError);
      }

      // 組合代幣投票歷史
      const voteHistory: VoteHistory[] = (votes || [])
        .filter(vote => vote.topics) // 只保留主題還存在的投票
        .map(vote => ({
          id: vote.id,
          topic_id: vote.topic_id,
          topic_title: (vote.topics as any)?.title || '未知主題',
          option_selected: vote.option || '未知選項',
          tokens_used: vote.amount || 0,
          is_free_vote: false,
          voted_at: vote.created_at,
          topic_status: (vote.topics as any)?.status || 'unknown',
          topic_tags: (vote.topics as any)?.tags || [],
        }));

      // 組合免費投票歷史
      const freeVoteHistory: VoteHistory[] = (freeVotes || [])
        .filter(vote => vote.topics) // 只保留主題還存在的投票
        .map(vote => ({
          id: vote.id,
          topic_id: vote.topic_id,
          topic_title: (vote.topics as any)?.title || '未知主題',
          option_selected: vote.option || '免費投票',
          tokens_used: 0,
          is_free_vote: true,
          voted_at: vote.used_at,
          topic_status: (vote.topics as any)?.status || 'unknown',
          topic_tags: (vote.topics as any)?.tags || [],
        }));

      // 合併並按時間排序
      const allHistory = [...voteHistory, ...freeVoteHistory]
        .sort((a, b) => new Date(b.voted_at).getTime() - new Date(a.voted_at).getTime());

      setHistory(allHistory);
    } catch (err: any) {
      console.error('Error fetching vote history:', err);
      setError(err.message || '獲取投票歷史失敗');
      toast.error('載入投票歷史失敗');
    } finally {
      setLoading(false);
    }
  };

  const refreshHistory = () => {
    fetchVoteHistory();
  };

  return {
    history,
    loading,
    error,
    refreshHistory,
  };
};

