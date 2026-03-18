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
  enableInfiniteScroll?: boolean; // 是否啟用無限滾動
}

export const useTopics = (options: UseTopicsOptions = {}) => {
  const { filter = 'all', limit = 20, userId, enableInfiniteScroll = false } = options;
  const [topics, setTopics] = useState<Topic[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [offset, setOffset] = useState(0);
  const [allJoinedTopicIds, setAllJoinedTopicIds] = useState<string[]>([]); // 緩存參與過的所有 topic IDs
  const { getConfig } = useSystemConfigCache();
  const graceDaysConfig = getConfig('home_expired_topic_grace_days', 3);
  const expiredGraceDays = Math.max(Number(graceDaysConfig) || 0, 0);

  // 當 filter、limit、userId 或 expiredGraceDays 改變時，重置並重新載入
  useEffect(() => {
    if (enableInfiniteScroll) {
      setOffset(0);
      setHasMore(true);
      setLoadingMore(false);
      if (filter === 'joined') {
        setTopics([]);
        setAllJoinedTopicIds([]);
      }
      // 熱門/最新：不先清空列表，等 fetch 完成再更新，避免高級卡樣式一瞬間跑掉
    }
    if (filter !== 'joined') {
      fetchTopics(0, true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter, limit, userId, expiredGraceDays]);

  const fetchTopics = async (currentOffset: number = 0, reset: boolean = false) => {
    try {
      if (reset || currentOffset === 0) {
        setLoading(true);
      } else {
        setLoadingMore(true);
      }
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
              p_offset: currentOffset,
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
              p_offset: currentOffset,
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
              p_offset: currentOffset,
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

        const rawExposure = topic.current_exposure_level ?? topic.exposure_level ?? null;
        const normalized = rawExposure ? String(rawExposure).trim().toLowerCase() : '';
        const currentExposure = (normalized === 'low' || normalized === 'normal' || normalized === 'medium' || normalized === 'high')
          ? (normalized === 'low' ? 'normal' : (normalized as 'normal' | 'medium' | 'high'))
          : null;
        return {
          ...topic,
          creator_name: topic.profiles?.nickname || '匿名用戶',
          creator_avatar: topic.profiles?.avatar || '👤',
          total_votes: totalVotes,
          is_hot: isHot,
          time_remaining: timeRemaining,
          current_exposure_level: currentExposure,
          exposure_expires_at: topic.exposure_expires_at || null,
        };
      });

      // 判斷是否還有更多資料
      const hasMoreData = processedTopics.length === limit;
      setHasMore(hasMoreData);

      // 更新主題列表：保留既有主題的 current_exposure_level，避免二次 fetch 後樣式跑掉
      const mergeExposure = (prevList: Topic[]) => {
        const prevById = new Map(prevList.map(t => [t.id, t]));
        return processedTopics.map(t => ({
          ...t,
          current_exposure_level: t.current_exposure_level ?? prevById.get(t.id)?.current_exposure_level ?? null,
        }));
      };
      if (reset || currentOffset === 0) {
        setTopics(prev => {
          const merged = mergeExposure(prev);
          const existingIds = new Set(prev.map(t => t.id));
          const newTopics = merged.filter(t => !existingIds.has(t.id));
          return newTopics.length > 0 ? newTopics : merged;
        });
        setOffset(processedTopics.length);
      } else {
        setTopics(prev => {
          const merged = mergeExposure(prev);
          const existingIds = new Set(prev.map(t => t.id));
          const newTopics = merged.filter(t => !existingIds.has(t.id));
          if (newTopics.length === 0) {
            setHasMore(false);
            return prev;
          }
          return [...prev, ...newTopics];
        });
        setOffset(prev => prev + processedTopics.length);
      }
    } catch (err: any) {
      console.error('Error fetching topics:', err);
      setError(err.message || '獲取主題列表失敗');
      toast.error('載入主題失敗');
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  // 獲取用戶參與過的主題（支援分頁）
  const fetchJoinedTopics = async (currentOffset: number = 0, reset: boolean = false) => {
    if (!userId) {
      setTopics([]);
      setLoading(false);
      return;
    }

    try {
      if (reset || currentOffset === 0) {
        setLoading(true);
      } else {
        setLoadingMore(true);
      }
      setError(null);

      // 計入：投票過（含免費票/代幣票）或自己建立的主題
      // 為了性能，我們只在首次載入時獲取所有 ID，之後使用緩存
      let allTopicIds: string[] = [];
      
      if (reset || currentOffset === 0 || allJoinedTopicIds.length === 0) {
        // 首次載入或重置時，獲取所有相關的 topic IDs
        const [
          { data: tokenVotes, error: tokenVotesError },
          { data: freeVotes, error: freeVotesError },
          { data: createdTopics, error: createdTopicsError },
        ] = await Promise.all([
          supabase
            .from('votes')
            .select('topic_id')
            .eq('user_id', userId),
          supabase
            .from('free_votes')
            .select('topic_id')
            .eq('user_id', userId),
          supabase
            .from('topics')
            .select('id')
            .eq('creator_id', userId)
        ]);

        if (tokenVotesError) throw tokenVotesError;
        if (freeVotesError) throw freeVotesError;
        if (createdTopicsError) throw createdTopicsError;

        const topicIds = [
          ...(tokenVotes?.map(v => v.topic_id) || []),
          ...(freeVotes?.map(v => v.topic_id) || []),
          ...(createdTopics?.map(t => t.id) || [])
        ];

        allTopicIds = [...new Set(topicIds)];
        setAllJoinedTopicIds(allTopicIds); // 緩存所有 IDs
      } else {
        // 使用緩存的 IDs
        allTopicIds = allJoinedTopicIds;
      }

      if (allTopicIds.length === 0) {
        setTopics([]);
        setHasMore(false);
        setLoading(false);
        setLoadingMore(false);
        return;
      }

      // 分頁處理：從所有 ID 中取出一部分
      const paginatedTopicIds = allTopicIds.slice(currentOffset, currentOffset + limit);
      
      if (paginatedTopicIds.length === 0) {
        setHasMore(false);
        setLoading(false);
        setLoadingMore(false);
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
        .in('id', paginatedTopicIds)
        .gte('end_at', graceCutoffDate.toISOString())
        .order('created_at', { ascending: false });

      if (fetchError) throw fetchError;

      const processedTopics: Topic[] = (data || []).map(topic => {
        const totalVotes = topic.options?.reduce(
          (sum: number, opt: any) => sum + (opt.votes || 0),
          0
        ) || 0;
        const rawExposure = topic.exposure_level ?? topic.current_exposure_level ?? null;
        const normalized = rawExposure ? String(rawExposure).trim().toLowerCase() : '';
        const currentExposure = (normalized === 'low' || normalized === 'normal' || normalized === 'medium' || normalized === 'high')
          ? (normalized === 'low' ? 'normal' : (normalized as 'normal' | 'medium' | 'high'))
          : null;
        const createdAt = new Date(topic.created_at);
        const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
        const isHot = totalVotes > 1000 || (createdAt > oneDayAgo && totalVotes > 100);
        return {
          ...topic,
          creator_name: topic.profiles?.nickname || '匿名用戶',
          creator_avatar: topic.profiles?.avatar || '👤',
          total_votes: totalVotes,
          time_remaining: getTimeRemaining(topic.end_at),
          current_exposure_level: currentExposure,
          is_hot: isHot,
        };
      });

      // 判斷是否還有更多資料
      const hasMoreData = currentOffset + processedTopics.length < allTopicIds.length;
      setHasMore(hasMoreData);

      // 更新主題列表（累積或重置）
      // 嚴格去重：確保同一主題不會重複顯示
      if (reset || currentOffset === 0) {
        // 重置時也要去重（防止初始載入時有重複）
        setTopics(prev => {
          const existingIds = new Set(prev.map(t => t.id));
          const newTopics = processedTopics.filter(t => !existingIds.has(t.id));
          return newTopics.length > 0 ? newTopics : processedTopics;
        });
        setOffset(processedTopics.length);
      } else {
        // 累積模式：嚴格避免重複
        setTopics(prev => {
          const existingIds = new Set(prev.map(t => t.id));
          const newTopics = processedTopics.filter(t => !existingIds.has(t.id));
          if (newTopics.length === 0) {
            // 如果所有新主題都已存在，可能是分頁問題，停止載入更多
            setHasMore(false);
            return prev;
          }
          return [...prev, ...newTopics];
        });
        setOffset(prev => prev + processedTopics.length);
      }
    } catch (err: any) {
      console.error('Error fetching joined topics:', err);
      setError(err.message || '獲取參與主題失敗');
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  // 如果是參與過篩選，使用專門的函數
  useEffect(() => {
    if (filter === 'joined') {
      if (enableInfiniteScroll) {
        // 無限滾動模式：重置狀態
        setTopics([]);
        setOffset(0);
        setHasMore(true);
        setLoadingMore(false);
        setAllJoinedTopicIds([]); // 清除緩存的 IDs
      }
      fetchJoinedTopics(0, true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter, userId, expiredGraceDays]);

  const refreshTopics = () => {
    setTopics([]);
    setOffset(0);
    setHasMore(true);
    fetchTopics(0, true);
  };

  // 載入更多（無限滾動）
  const loadMore = async () => {
    if (!hasMore || loadingMore || loading) {
      return;
    }
    if (filter === 'joined') {
      await fetchJoinedTopics(offset, false);
    } else {
      await fetchTopics(offset, false);
    }
  };

  return {
    topics,
    loading,
    loadingMore,
    error,
    hasMore,
    refreshTopics,
    loadMore,
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

