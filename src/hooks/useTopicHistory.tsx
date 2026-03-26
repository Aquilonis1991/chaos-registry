import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { TimeFilterOption, getStartDateFromFilter } from "@/components/TimeFilter";

export interface TopicHistory {
  id: string;
  title: string;
  description?: string;
  tags: string[];
  status: string;
  created_at: string;
  end_at: string;
  total_votes: number;
  free_votes_count: number;
  exposure_level: string;
  duration_days: number;
  options: Array<{
    id: string;
    text: string;
    votes: number;
  }>;
}

export const useTopicHistory = (userId: string | undefined, options?: { timeFilter?: TimeFilterOption | null; isAdmin?: boolean }) => {
  const { timeFilter = null, isAdmin = false } = options || {};
  const [topics, setTopics] = useState<TopicHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) {
      setTopics([]);
      setLoading(false);
      return;
    }

    fetchTopicHistory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, timeFilter, isAdmin]);

  const fetchTopicHistory = async () => {
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

      // 先收集「參與過」的 topic id：
      // - 自己建立
      // - 投票過（votes）
      // - topic_participants 紀錄
      // - 新增選項紀錄
      // - 延長時間紀錄
      const [
        createdTopicsResult,
        votedTopicsResult,
        participantTopicsResult,
        optionAddedTopicsResult,
        extendedTopicsResult,
      ] = await Promise.all([
        supabase
          .from('topics')
          .select('id')
          .eq('creator_id', userId),
        supabase
          .from('votes')
          .select('topic_id')
          .eq('user_id', userId),
        supabase
          .from('topic_participants')
          .select('topic_id')
          .eq('user_id', userId),
        supabase
          .from('topic_option_logs')
          .select('topic_id')
          .eq('user_id', userId),
        (supabase as any)
          .from('topic_extension_logs')
          .select('topic_id')
          .eq('user_id', userId),
      ]);

      const idSet = new Set<string>();
      (createdTopicsResult.data || []).forEach((row: any) => row?.id && idSet.add(row.id));
      (votedTopicsResult.data || []).forEach((row: any) => row?.topic_id && idSet.add(row.topic_id));
      (participantTopicsResult.data || []).forEach((row: any) => row?.topic_id && idSet.add(row.topic_id));
      ((optionAddedTopicsResult.data as any[]) || []).forEach((row: any) => row?.topic_id && idSet.add(row.topic_id));
      ((extendedTopicsResult.data as any[]) || []).forEach((row: any) => row?.topic_id && idSet.add(row.topic_id));

      const topicIds = Array.from(idSet);
      if (topicIds.length === 0) {
        setTopics([]);
        return;
      }

      // 以收集到的 topic id 再查完整主題資料
      let query = supabase
        .from('topics')
        .select('id, title, description, tags, status, created_at, end_at, exposure_level, duration_days, options')
        .in('id', topicIds);

      // 應用時間篩選（以主題建立時間為準）
      if (startDate) {
        query = query.gte('created_at', startDate.toISOString());
      }

      // 如果不是管理員，限制在 1 年內
      if (minDate) {
        const effectiveMinDate = startDate && startDate > minDate ? startDate : minDate;
        query = query.gte('created_at', effectiveMinDate.toISOString());
      }

      const { data, error: fetchError } = await query.order('created_at', { ascending: false });

      if (fetchError) throw fetchError;

      const processedTopics: TopicHistory[] = (data || []).map(topic => {
        const totalVotes = topic.options?.reduce(
          (sum: number, opt: any) => sum + (opt.votes || 0), 
          0
        ) || 0;

        return {
          ...topic,
          total_votes: totalVotes,
        };
      });

      setTopics(processedTopics);
    } catch (err: any) {
      console.error('Error fetching topic history:', err);
      setError(err.message || '獲取主題歷史失敗');
      toast.error('載入發起紀錄失敗');
    } finally {
      setLoading(false);
    }
  };

  const refreshHistory = () => {
    fetchTopicHistory();
  };

  return {
    topics,
    loading,
    error,
    refreshHistory,
  };
};

