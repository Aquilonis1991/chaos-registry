import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface TopicDetail {
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
  // Populated fields
  creator_name?: string;
  creator_avatar?: string;
  total_votes?: number;
  time_remaining?: string;
}

export const useTopicDetail = (topicId: string | undefined) => {
  const [topic, setTopic] = useState<TopicDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!topicId) {
      setLoading(false);
      return;
    }

    fetchTopicDetail();
  }, [topicId]);

  const fetchTopicDetail = async () => {
    if (!topicId) return;

    try {
      setLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase
        .from('topics')
        .select(`
          *,
          profiles:creator_id (
            nickname,
            avatar
          )
        `)
        .eq('id', topicId)
        .single();

      if (fetchError) throw fetchError;

      if (!data) {
        throw new Error('主題不存在');
      }

      // 計算總投票數
      const totalVotes = data.options?.reduce(
        (sum: number, opt: any) => sum + (opt.votes || 0), 
        0
      ) || 0;

      // 計算剩餘時間
      const timeRemaining = getTimeRemaining(data.end_at);

      const processedTopic: TopicDetail = {
        ...data,
        creator_name: data.profiles?.nickname || '匿名用戶',
        creator_avatar: data.profiles?.avatar || '👤',
        total_votes: totalVotes,
        time_remaining: timeRemaining,
      };

      setTopic(processedTopic);
    } catch (err: any) {
      console.error('Error fetching topic detail:', err);
      setError(err.message || '獲取主題詳情失敗');
      toast.error('載入主題失敗');
    } finally {
      setLoading(false);
    }
  };

  const refreshTopic = () => {
    fetchTopicDetail();
  };

  // 設置即時更新（每5分鐘刷新一次）
  useEffect(() => {
    if (!topicId) return;

    const interval = setInterval(() => {
      fetchTopicDetail();
    }, 5 * 60 * 1000); // 5 分鐘

    return () => clearInterval(interval);
  }, [topicId]);

  return {
    topic,
    loading,
    error,
    refreshTopic,
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
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

  if (days > 0) return `剩餘 ${days} 天`;
  if (hours > 0) return `剩餘 ${hours} 小時`;
  if (minutes > 0) return `剩餘 ${minutes} 分鐘`;
  return '即將結束';
}

