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

      // 構建查詢
      let query = supabase
        .from('topics')
        .select('*')
        .eq('creator_id', userId);

      // 應用時間篩選
      if (startDate) {
        query = query.gte('created_at', startDate.toISOString());
      }
      
      // 如果不是管理員，限制在1年內
      if (minDate) {
        const effectiveMinDate = startDate && startDate > minDate ? startDate : minDate;
        query = query.gte('created_at', effectiveMinDate.toISOString());
      }

      const { data, error: fetchError } = await query
        .order('created_at', { ascending: false });

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

