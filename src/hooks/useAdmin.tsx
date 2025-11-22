import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

export const useAdmin = () => {
  const { user, loading: authLoading } = useAuth();

  const { data: isAdmin, isLoading, error } = useQuery({
    queryKey: ['admin-status', user?.id],
    queryFn: async () => {
      if (!user?.id) {
        console.log('[useAdmin] No user ID, returning false');
        return false;
      }

      console.log('[useAdmin] Checking admin status for user:', user.id);
      
      try {
        const { data, error } = await supabase
          .from('admin_users')
          .select('user_id')
          .eq('user_id', user.id)
          .maybeSingle(); // 使用 maybeSingle 而不是 single，避免找不到記錄時報錯

        if (error) {
          console.error('[useAdmin] Error checking admin status:', error);
          return false;
        }

        const result = !!data;
        console.log('[useAdmin] Admin status result:', result);
        return result;
      } catch (err) {
        console.error('[useAdmin] Exception checking admin status:', err);
        return false;
      }
    },
    enabled: !!user?.id && !authLoading, // 等待 auth 載入完成
    retry: 1, // 只重試一次
    staleTime: 5 * 60 * 1000, // 5 分鐘內不重新查詢
  });

  // 如果 auth 還在載入，isLoading 應該為 true
  const finalLoading = authLoading || isLoading;

  return { 
    isAdmin: isAdmin || false, 
    isLoading: finalLoading,
    error 
  };
};
