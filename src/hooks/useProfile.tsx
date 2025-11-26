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
  last_login?: string | null;
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

  const fetchProfile = async (showLoading: boolean = false) => {
    if (!user) {
      setProfile(null);
      setLoading(false);
      return;
    }

    try {
      // 只在首次加載或明確要求時顯示 loading
      if (showLoading || !profile) {
        setLoading(true);
      }
      
      // Fetch full profile data for authenticated user
      const { data, error } = await supabase
        .from('profiles')
        .select('id, nickname, avatar, tokens, ad_watch_count, last_login, notifications, created_at, updated_at, is_deleted, deleted_reason')
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

    // 首次加載時顯示 loading
    fetchProfile(true);

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
          // 實時訂閱自動更新 profile，包括代幣數量
          // 注意：實時訂閱的數據是權威來源，會直接覆蓋任何樂觀更新
          // 這是正確的行為，確保最終一致性
          const newProfile = payload.new as Profile;
          
          // 靜默更新，不觸發任何 toast 或副作用
          // toast 應該只在用戶操作成功時顯示一次（在 MissionPage 中）
          setProfile(newProfile);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  // 樂觀更新代幣數量（用於立即更新 UI）
  // 注意：此更新會被實時訂閱覆蓋，所以不會導致重複更新
  // 實時訂閱會在數據庫更新時自動同步，確保最終一致性
  const updateTokensOptimistically = (delta: number) => {
    setProfile((currentProfile) => {
      if (currentProfile) {
        const newTokens = Math.max(0, (currentProfile.tokens || 0) + delta);
        return {
          ...currentProfile,
          tokens: newTokens
        };
      }
      return currentProfile;
    });
  };

  // refreshProfile 包裝函數，不顯示 loading（用於背景刷新）
  const refreshProfile = async () => {
    await fetchProfile(false);
  };

  return { profile, loading, refreshProfile, updateTokensOptimistically };
};
