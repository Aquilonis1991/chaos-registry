import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useSystemConfigCache } from "@/hooks/useSystemConfigCache";

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
  // Exposure fields
  current_exposure_level?: 'normal' | 'medium' | 'high' | null;
  exposure_expires_at?: string | null;
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
  const { getConfig } = useSystemConfigCache();
  const graceDaysConfig = getConfig('home_expired_topic_grace_days', 3);
  const expiredGraceDays = Math.max(Number(graceDaysConfig) || 0, 0);

  useEffect(() => {
    fetchTopics();
  }, [filter, limit, userId, expiredGraceDays]);

  const fetchTopics = async () => {
    try {
      setLoading(true);
      setError(null);

      let data: any[] = [];
      let fetchError: any = null;

      // 根據篩選條件使用不同的 SQL 函數
      switch (filter) {
        case 'hot':
          // 使用新的熱門排序函數（含曝光排序和寬限期）
          const { data: hotData, error: hotError } = await supabase.rpc(
            'get_hot_topics_with_exposure',
            {
              p_limit: limit,
              p_offset: 0,
              p_grace_days: expiredGraceDays
            }
          );
          data = hotData || [];
          fetchError = hotError;

          // 獲取創建者資訊
          if (!fetchError && data.length > 0) {
            const creatorIds = [...new Set(data.map(t => t.creator_id))];
            const { data: profiles } = await supabase
              .from('profiles')
              .select('id, nickname, avatar')
              .in('id', creatorIds);

            const profileMap = new Map(profiles?.map(p => [p.id, p]) || []);
            data = data.map(topic => ({
              ...topic,
              profiles: profileMap.get(topic.creator_id),
            }));
          }
          break;

        case 'latest':
          // 使用新的最新排序函數（含曝光插隊和寬限期）
          const { data: latestData, error: latestError } = await supabase.rpc(
            'get_latest_topics_with_exposure',
            {
              p_limit: limit,
              p_offset: 0,
              p_grace_days: expiredGraceDays
            }
          );
          data = latestData || [];
          fetchError = latestError;

          // 獲取創建者資訊
          if (!fetchError && data.length > 0) {
            const creatorIds = [...new Set(data.map(t => t.creator_id))];
            const { data: profiles } = await supabase
              .from('profiles')
              .select('id, nickname, avatar')
              .in('id', creatorIds);

            const profileMap = new Map(profiles?.map(p => [p.id, p]) || []);
            data = data.map(topic => ({
              ...topic,
              profiles: profileMap.get(topic.creator_id),
            }));
          }
          break;

        case 'joined':
          // 參與過：需要用戶ID，使用原有邏輯
          if (!userId) {
            setTopics([]);
            setLoading(false);
            return;
          }
          // 這裡需要額外查詢用戶參與過的主題
          return; // 交給 fetchJoinedTopics 處理

        default:
          // 預設使用熱門排序
          const { data: defaultData, error: defaultError } = await supabase.rpc(
            'get_hot_topics_with_exposure',
            {
              p_limit: limit,
              p_offset: 0,
              p_grace_days: expiredGraceDays
            }
          );
          data = defaultData || [];
          fetchError = defaultError;

          if (!fetchError && data.length > 0) {
            const creatorIds = [...new Set(data.map(t => t.creator_id))];
            const { data: profiles } = await supabase
              .from('profiles')
              .select('id, nickname, avatar')
              .in('id', creatorIds);

            const profileMap = new Map(profiles?.map(p => [p.id, p]) || []);
            data = data.map(topic => ({
              ...topic,
              profiles: profileMap.get(topic.creator_id),
            }));
          }
      }

      if (fetchError) throw fetchError;

      // 處理資料並計算額外欄位
      const processedTopics: Topic[] = (data || []).map(topic => {
        // 計算總投票數（如果沒有從 SQL 函數返回）
        const totalVotes = topic.total_votes || topic.options?.reduce(
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
          current_exposure_level: topic.current_exposure_level || null,
          exposure_expires_at: topic.exposure_expires_at || null,
        };
      });

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

      // 僅計入使用代幣投票過或自己建立的主題
      const [{ data: tokenVotes, error: tokenVotesError }, { data: createdTopics, error: createdTopicsError }] = await Promise.all([
        supabase
          .from('votes')
          .select('topic_id')
          .eq('user_id', userId),
        supabase
          .from('topics')
          .select('id')
          .eq('creator_id', userId)
      ]);

      if (tokenVotesError) throw tokenVotesError;
      if (createdTopicsError) throw createdTopicsError;

      const topicIds = [
        ...(tokenVotes?.map(v => v.topic_id) || []),
        ...(createdTopics?.map(t => t.id) || [])
      ];

      const uniqueTopicIds = [...new Set(topicIds)];

      if (uniqueTopicIds.length === 0) {
        setTopics([]);
        setLoading(false);
        return;
      }

      const graceCutoffDate = new Date(Date.now() - expiredGraceDays * 24 * 60 * 60 * 1000);
      const { data, error: fetchError } = await supabase
        .from('topics')
        .select(`
          *,
          profiles:creator_id (
            nickname,
            avatar
          )
        `)
        .in('id', uniqueTopicIds)
        .eq('status', 'active')
        .gte('end_at', graceCutoffDate.toISOString())
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
  }, [filter, userId, expiredGraceDays]);

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

