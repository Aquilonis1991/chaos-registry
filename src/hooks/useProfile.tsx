import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { toast } from "sonner";

export interface Profile {
  id: string;
  nickname: string;
  avatar: string;
  tokens: number;
  ad_watch_count: number;
  notifications: boolean;
  created_at: string;
  updated_at: string;
  is_deleted?: boolean;
  deleted_reason?: string | null;
}

export const useProfile = () => {
  const { user } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchProfile = async () => {
    if (!user) {
      setProfile(null);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      // Fetch full profile data for authenticated user
      const { data, error } = await supabase
        .from('profiles')
        .select('id, nickname, avatar, tokens, ad_watch_count, notifications, created_at, updated_at, is_deleted, deleted_reason')
        .eq('id', user.id)
        .single();

      if (error) throw error;

      if (data?.is_deleted) {
        toast.error('帳號已被刪除，請重新註冊或聯繫客服');
        setProfile(null);
        await supabase.auth.signOut();
        return;
      }

      setProfile(data);
    } catch (error) {
      console.error('Error fetching profile:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!user) {
      setProfile(null);
      setLoading(false);
      return;
    }

    fetchProfile();

    // Set up realtime subscription
    const channel = supabase
      .channel('profile-changes')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'profiles',
          filter: `id=eq.${user.id}`
        },
        (payload) => {
          setProfile(payload.new as Profile);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  return { profile, loading, refreshProfile: fetchProfile };
};
