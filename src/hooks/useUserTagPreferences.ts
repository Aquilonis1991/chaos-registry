import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface UserTagPreference {
  normalized_tag: string;
  display_tag: string;
  vote_count: number;
  token_amount: number;
  last_voted_at: string | null;
}

export const useUserTagPreferences = (targetUserId?: string) => {
  const [preferences, setPreferences] = useState<UserTagPreference[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPreferences = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: rpcError } = await supabase
        .rpc("get_user_tag_preferences", targetUserId ? { p_user_id: targetUserId } : {});

      if (rpcError) throw rpcError;

      setPreferences(data || []);
    } catch (err: any) {
      console.error("Failed to load user tag preferences:", err);
      const message = err?.message || "無法載入標籤偏好資料";
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }, [targetUserId]);

  useEffect(() => {
    void fetchPreferences();
  }, [fetchPreferences]);

  return { preferences, loading, error, refresh: fetchPreferences };
};

