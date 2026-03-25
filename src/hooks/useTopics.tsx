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
  /** 依 created_at 降序、且已通過 end_at 寬限篩選的 topic id（供「參與過」正確分頁） */
  const [joinedTopicIdsSorted, setJoinedTopicIdsSorted] = useState<string[]>([]);
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
        setJoinedTopicIdsSorted([]);
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

    const graceCutoffDate = new Date(Date.now() - expiredGraceDays * 24 * 60 * 60 * 1000);
    const graceCutoffISO = graceCutoffDate.toISOString();
    const IN_CHUNK = 120;

    try {
      if (reset || currentOffset === 0) {
        setLoading(true);
      } else {
        setLoadingMore(true);
      }
      setError(null);

      let sortedIds: string[] = joinedTopicIdsSorted;

      const shouldRebuildIndex =
        reset || currentOffset === 0 || joinedTopicIdsSorted.length === 0;

      if (shouldRebuildIndex) {
        const [
          { data: tokenVotes, error: tokenVotesError },
          { data: freeVotes, error: freeVotesError },
          { data: createdTopics, error: createdTopicsError },
          { data: participants, error: participantsError },
          { data: optionLogs, error: optionLogsError },
          { data: extLogs, error: extLogsError },
        ] = await Promise.all([
          supabase.from('votes').select('topic_id').eq('user_id', userId),
          supabase.from('free_votes').select('topic_id').eq('user_id', userId),
          supabase.from('topics').select('id').eq('creator_id', userId),
          supabase.from('topic_participants').select('topic_id').eq('user_id', userId),
          supabase.from('topic_option_logs').select('topic_id').eq('user_id', userId),
          supabase.from('topic_extension_logs').select('topic_id').eq('user_id', userId),
        ]);

        if (tokenVotesError) throw tokenVotesError;
        if (freeVotesError) throw freeVotesError;
        if (createdTopicsError) throw createdTopicsError;
        if (participantsError) console.warn('[joined topics] topic_participants:', participantsError);
        if (optionLogsError) console.warn('[joined topics] topic_option_logs:', optionLogsError);
        if (extLogsError) console.warn('[joined topics] topic_extension_logs:', extLogsError);

        const rawIdSet = new Set<string>();
        tokenVotes?.forEach((v) => v.topic_id && rawIdSet.add(v.topic_id));
        freeVotes?.forEach((v) => v.topic_id && rawIdSet.add(v.topic_id));
        createdTopics?.forEach((t) => t.id && rawIdSet.add(t.id));
        participants?.forEach((p) => p.topic_id && rawIdSet.add(p.topic_id));
        optionLogs?.forEach((r) => r.topic_id && rawIdSet.add(r.topic_id));
        extLogs?.forEach((r) => r.topic_id && rawIdSet.add(r.topic_id));

        const allRawIds = Array.from(rawIdSet);

        if (allRawIds.length === 0) {
          setJoinedTopicIdsSorted([]);
          setTopics([]);
          setHasMore(false);
          setOffset(0);
          return;
        }

        const metaRows: { id: string; created_at: string }[] = [];
        for (let i = 0; i < allRawIds.length; i += IN_CHUNK) {
          const chunk = allRawIds.slice(i, i + IN_CHUNK);
          const { data: meta, error: metaErr } = await supabase
            .from('topics')
            .select('id, created_at')
            .in('id', chunk)
            .gte('end_at', graceCutoffISO);
          if (metaErr) throw metaErr;
          (meta || []).forEach((row: any) => {
            if (row?.id) metaRows.push({ id: row.id, created_at: row.created_at });
          });
        }

        const byId = new Map<string, { id: string; created_at: string }>();
        for (const r of metaRows) byId.set(r.id, r);

        sortedIds = Array.from(byId.values())
          .sort(
            (a, b) =>
              new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
          )
          .map((r) => r.id);

        setJoinedTopicIdsSorted(sortedIds);
      }

      const pageIds = sortedIds.slice(currentOffset, currentOffset + limit);

      if (pageIds.length === 0) {
        setHasMore(false);
        if (reset || currentOffset === 0) setTopics([]);
        return;
      }

      const detailRows: any[] = [];
      for (let i = 0; i < pageIds.length; i += IN_CHUNK) {
        const chunk = pageIds.slice(i, i + IN_CHUNK);
        const { data, error: fetchError } = await supabase
          .from('topics')
          .select(
            `
          *,
          profiles:creator_id (
            nickname,
            avatar
          )
        `
          )
          .in('id', chunk);
        if (fetchError) throw fetchError;
        (data || []).forEach((t) => detailRows.push(t));
      }

      const order = new Map(pageIds.map((id, idx) => [id, idx]));
      const sortedPage = detailRows.sort(
        (a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0)
      );

      const data = sortedPage;
      const processedTopics: Topic[] = (data || []).map((topic) => {
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

      const nextOffset = currentOffset + pageIds.length;
      const hasMoreData = nextOffset < sortedIds.length;
      setHasMore(hasMoreData);

      if (reset || currentOffset === 0) {
        setTopics(processedTopics);
        setOffset(nextOffset);
      } else {
        setTopics((prev) => [...prev, ...processedTopics]);
        setOffset(nextOffset);
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
        setJoinedTopicIdsSorted([]); // 清除緩存的排序 id
      }
      fetchJoinedTopics(0, true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter, userId, expiredGraceDays]);

  const refreshTopics = () => {
    setTopics([]);
    setOffset(0);
    setHasMore(true);
    if (filter === 'joined') {
      setJoinedTopicIdsSorted([]);
      fetchJoinedTopics(0, true);
    } else {
      fetchTopics(0, true);
    }
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

