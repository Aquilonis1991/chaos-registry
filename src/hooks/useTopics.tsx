import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface Topic {
  id: string;
  title: string;
  description?: string;
  tags: string[];
  creator_id: string;
  exposure_level: string;
  duration_days: number;
  created_at: string;
  end_at: string;
  status: string;
  options: Array<{
    id: string;
    text: string;
    votes: number;
  }>;
  free_votes_count: number;
  // Computed fields
  creator_name?: string;
  creator_avatar?: string;
  total_votes?: number;
  is_hot?: boolean;
  time_remaining?: string;
}

interface UseTopicsOptions {
  filter?: 'hot' | 'latest' | 'joined' | 'all';
  limit?: number;
  userId?: string;
}

export const useTopics = (options: UseTopicsOptions = {}) => {
  const { filter = 'all', limit = 20, userId } = options;
  const [topics, setTopics] = useState<Topic[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchTopics();
  }, [filter, limit, userId]);

  const fetchTopics = async () => {
    try {
      setLoading(true);
      setError(null);

      let query = supabase
        .from('topics')
        .select(`
          *,
          profiles:creator_id (
            nickname,
            avatar
          )
        `)
        .eq('status', 'active')
        .eq('is_hidden', false)  // 只顯示未隱藏的主題
        .gte('end_at', new Date().toISOString());

      // 根據篩選條件調整查詢
      switch (filter) {
        case 'hot':
          // 熱門：按總投票數排序
          query = query.order('created_at', { ascending: false });
          break;
        case 'latest':
          // 最新：按創建時間排序
          query = query.order('created_at', { ascending: false });
          break;
        case 'joined':
          // 參與過：需要用戶ID
          if (!userId) {
            setTopics([]);
            setLoading(false);
            return;
          }
          // 這裡需要額外查詢用戶參與過的主題
          break;
        default:
          query = query.order('created_at', { ascending: false });
      }

      query = query.limit(limit);

      const { data, error: fetchError } = await query;

      if (fetchError) throw fetchError;

      // 處理資料並計算額外欄位
      const processedTopics: Topic[] = (data || []).map(topic => {
        // 計算總投票數
        const totalVotes = topic.options?.reduce(
          (sum: number, opt: any) => sum + (opt.votes || 0), 
          0
        ) || 0;

        // 計算剩餘時間
        const timeRemaining = getTimeRemaining(topic.end_at);

        // 判斷是否為熱門（總投票數 > 1000 或者最近1天內創建且投票數 > 100）
        const createdAt = new Date(topic.created_at);
        const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
        const isHot = totalVotes > 1000 || (createdAt > oneDayAgo && totalVotes > 100);

        return {
          ...topic,
          creator_name: topic.profiles?.nickname || '匿名用戶',
          creator_avatar: topic.profiles?.avatar || '👤',
          total_votes: totalVotes,
          is_hot: isHot,
          time_remaining: timeRemaining,
        };
      });

      // 如果是熱門篩選，按投票數排序
      if (filter === 'hot') {
        processedTopics.sort((a, b) => (b.total_votes || 0) - (a.total_votes || 0));
      }

      setTopics(processedTopics);
    } catch (err: any) {
      console.error('Error fetching topics:', err);
      setError(err.message || '獲取主題列表失敗');
      toast.error('載入主題失敗');
    } finally {
      setLoading(false);
    }
  };

  // 獲取用戶參與過的主題
  const fetchJoinedTopics = async () => {
    if (!userId) {
      setTopics([]);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // 從 votes 欄位中查找包含該用戶的主題
      // 或者從 free_votes 表查詢
      const { data: freeVotes, error: freeVotesError } = await supabase
        .from('free_votes')
        .select('topic_id')
        .eq('user_id', userId);

      if (freeVotesError) throw freeVotesError;

      const topicIds = freeVotes?.map(v => v.topic_id) || [];

      if (topicIds.length === 0) {
        setTopics([]);
        setLoading(false);
        return;
      }

      const { data, error: fetchError } = await supabase
        .from('topics')
        .select(`
          *,
          profiles:creator_id (
            nickname,
            avatar
          )
        `)
        .in('id', topicIds)
        .eq('status', 'active')
        .order('created_at', { ascending: false });

      if (fetchError) throw fetchError;

      const processedTopics: Topic[] = (data || []).map(topic => {
        const totalVotes = topic.options?.reduce(
          (sum: number, opt: any) => sum + (opt.votes || 0), 
          0
        ) || 0;

        return {
          ...topic,
          creator_name: topic.profiles?.nickname || '匿名用戶',
          creator_avatar: topic.profiles?.avatar || '👤',
          total_votes: totalVotes,
          time_remaining: getTimeRemaining(topic.end_at),
        };
      });

      setTopics(processedTopics);
    } catch (err: any) {
      console.error('Error fetching joined topics:', err);
      setError(err.message || '獲取參與主題失敗');
    } finally {
      setLoading(false);
    }
  };

  // 如果是參與過篩選，使用專門的函數
  useEffect(() => {
    if (filter === 'joined') {
      fetchJoinedTopics();
    }
  }, [filter, userId]);

  const refreshTopics = () => {
    fetchTopics();
  };

  return {
    topics,
    loading,
    error,
    refreshTopics,
  };
};

// 輔助函數：計算剩餘時間
function getTimeRemaining(endAt: string): string {
  const now = new Date();
  const end = new Date(endAt);
  const diff = end.getTime() - now.getTime();

  if (diff <= 0) return '已結束';

  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));

  if (days > 0) return `剩餘 ${days} 天`;
  if (hours > 0) return `剩餘 ${hours} 小時`;
  return '即將結束';
}

