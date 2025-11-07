import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

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

export const useTopicHistory = (userId: string | undefined) => {
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
  }, [userId]);

  const fetchTopicHistory = async () => {
    if (!userId) return;

    try {
      setLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase
        .from('topics')
        .select('*')
        .eq('creator_id', userId)
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

