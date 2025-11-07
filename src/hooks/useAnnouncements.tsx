import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

interface Announcement {
  id: string;
  title: string;
  content: string;
  summary?: string;
  image_url?: string;
  priority: number;
  click_count: number;
  created_at: string;
}

export const useAnnouncements = () => {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchAnnouncements();
  }, []);

  const fetchAnnouncements = async () => {
    try {
      setLoading(true);
      setError(null);

      const { data, error } = await supabase.rpc('get_active_announcements', {
        limit_count: 3
      });

      if (error) throw error;
      setAnnouncements(data || []);
    } catch (err: any) {
      console.error('Error fetching announcements:', err);
      setError(err.message || '獲取公告失敗');
    } finally {
      setLoading(false);
    }
  };

  const incrementClickCount = async (announcementId: string) => {
    try {
      await supabase.rpc('increment_announcement_clicks', {
        announcement_id: announcementId
      });
    } catch (error) {
      console.error('Error incrementing click count:', error);
    }
  };

  const refreshAnnouncements = () => {
    fetchAnnouncements();
  };

  return {
    announcements,
    loading,
    error,
    incrementClickCount,
    refreshAnnouncements,
  };
};
