import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { TimeFilterOption, getStartDateFromFilter } from "@/components/TimeFilter";

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

interface UseVoteHistoryOptions {
  userId: string | undefined;
  timeFilter?: TimeFilterOption | null;
  isAdmin?: boolean;
}

const resolveOptionText = (topicOptions: any[] | undefined, selectedOption: string | null) => {
  if (!selectedOption) return '未知選項';
  if (!Array.isArray(topicOptions)) return selectedOption;

  const normalizedSelected = selectedOption.trim();
  const matchedOption = topicOptions.find((option) => {
    // options 以 JSON 儲存，可能包含 id/text；舊資料也可能直接儲存文字
    if (typeof option === 'string') {
      return option.trim() === normalizedSelected;
    }
    if (option?.id) {
      return option.id === normalizedSelected;
    }
    if (option?.text) {
      return option.text.trim() === normalizedSelected;
    }
    return false;
  });

  if (!matchedOption) {
    return normalizedSelected; // 找不到時保留原始值（避免顯示空白）
  }

  if (typeof matchedOption === 'string') {
    return matchedOption;
  }

  return matchedOption.text || normalizedSelected;
};

export const useVoteHistory = (userId: string | undefined, options?: { timeFilter?: TimeFilterOption | null; isAdmin?: boolean }) => {
  const { timeFilter = null, isAdmin = false } = options || {};
  const [history, setHistory] = useState<VoteHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchVoteHistory = async () => {
    if (!userId) return;

    try {
      setLoading(true);
      setError(null);

      // 計算時間篩選條件
      const startDate = getStartDateFromFilter(timeFilter);

      // 如果不是管理員，限制查詢範圍在1年內
      const oneYearAgo = new Date();
      oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
      const minDate = !isAdmin ? oneYearAgo : null;

      // 構建時間查詢條件
      let votesQuery = supabase
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
        .eq('user_id', userId);

      // 應用時間篩選
      if (startDate) {
        votesQuery = votesQuery.gte('created_at', startDate.toISOString());
      }

      // 如果不是管理員，限制在1年內
      if (minDate) {
        const effectiveMinDate = startDate && startDate > minDate ? startDate : minDate;
        votesQuery = votesQuery.gte('created_at', effectiveMinDate.toISOString());
      }

      const { data: votes, error: votesError } = await votesQuery
        .order('created_at', { ascending: false });

      if (votesError) {
        console.warn('獲取代幣投票記錄失敗：', votesError);
      }

      // 獲取免費投票記錄
      let freeVotesQuery = supabase
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
        .eq('user_id', userId);

      // 應用時間篩選
      if (startDate) {
        freeVotesQuery = freeVotesQuery.gte('used_at', startDate.toISOString());
      }

      // 如果不是管理員，限制在1年內
      if (minDate) {
        const effectiveMinDate = startDate && startDate > minDate ? startDate : minDate;
        freeVotesQuery = freeVotesQuery.gte('used_at', effectiveMinDate.toISOString());
      }

      const { data: freeVotes, error: freeVotesError } = await freeVotesQuery
        .order('used_at', { ascending: false });

      if (freeVotesError) {
        console.warn('獲取免費投票記錄失敗：', freeVotesError);
      }

      // 組合代幣投票歷史
      const voteHistory: VoteHistory[] = (votes || [])
        //.filter(vote => vote.topics) // Don't filter, show even if topic deleted
        .map(vote => ({
          id: vote.id,
          topic_id: vote.topic_id,
          topic_title: (vote.topics as any)?.title || '已刪除的主題',
          option_selected: resolveOptionText((vote.topics as any)?.options, vote.option),
          tokens_used: vote.amount || 0,
          is_free_vote: false,
          voted_at: vote.created_at,
          topic_status: (vote.topics as any)?.status || 'unknown',
          topic_tags: (vote.topics as any)?.tags || [],
        }));

      // 組合免費投票歷史
      const freeVoteHistory: VoteHistory[] = (freeVotes || [])
        //.filter(vote => vote.topics) // Don't filter
        .map(vote => ({
          id: vote.id,
          topic_id: vote.topic_id,
          topic_title: (vote.topics as any)?.title || '已刪除的主題',
          option_selected: resolveOptionText((vote.topics as any)?.options, vote.option),
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

  useEffect(() => {
    if (!userId) {
      setHistory([]);
      setLoading(false);
      return;
    }

    fetchVoteHistory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, timeFilter, isAdmin]);

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

