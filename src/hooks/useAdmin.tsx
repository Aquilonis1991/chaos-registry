import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

export const useAdmin = () => {
  const { user, loading: authLoading } = useAuth();

  // 強制輸出日誌（即使被壓縮也會保留）
  if (typeof window !== 'undefined') {
    window.console?.log?.('[useAdmin] Hook called:', { 
      hasUser: !!user, 
      userId: user?.id, 
      authLoading 
    });
  }

  const { data: isAdmin, isLoading, error } = useQuery({
    queryKey: ['admin-status', user?.id],
    queryFn: async () => {
      // 強制輸出日誌
      if (typeof window !== 'undefined') {
        window.console?.log?.('[useAdmin] Query function called for user:', user?.id);
      }
      
      if (!user?.id) {
        if (typeof window !== 'undefined') {
          window.console?.log?.('[useAdmin] No user ID, returning false');
        }
        return false;
      }

      if (typeof window !== 'undefined') {
        window.console?.log?.('[useAdmin] Checking admin status for user:', user.id);
      }
      
      try {
        // 優先使用 RPC 函數（更可靠，繞過 RLS 限制）
        // 添加超時處理（10秒）
        try {
          console.log('[useAdmin] Attempting RPC call...');
          
          const rpcPromise = supabase.rpc('is_admin', { check_user_id: user.id });
          const timeoutPromise = new Promise<{ data: null; error: { message: string } }>((_, reject) => 
            setTimeout(() => reject(new Error('RPC 查詢超時（10秒）')), 10000)
          );
          
          let rpcResult: { data: any; error: any };
          try {
            rpcResult = await Promise.race([
              rpcPromise,
              timeoutPromise
            ]) as { data: any; error: any };
          } catch (timeoutError: any) {
            console.warn('[useAdmin] RPC timeout, trying direct query:', timeoutError);
            throw new Error('RPC timeout');
          }
          
          const { data: rpcData, error: rpcError } = rpcResult;
          
          console.log('[useAdmin] RPC response:', { rpcData, rpcError });
          
          if (!rpcError && rpcData !== null && rpcData !== undefined) {
            const result = !!rpcData;
            console.log('[useAdmin] Admin status (via RPC):', result);
            return result;
          }
          
          if (rpcError) {
            console.warn('[useAdmin] RPC error, trying direct query:', rpcError);
          }
        } catch (rpcErr) {
          console.warn('[useAdmin] RPC exception, trying direct query:', rpcErr);
        }

        // 備用方法：直接查詢 admin_users 表
        // 添加超時處理（8秒）
        console.log('[useAdmin] Attempting direct query...');
        
        const queryPromise = supabase
          .from('admin_users')
          .select('user_id')
          .eq('user_id', user.id)
          .maybeSingle();
        
        const timeoutPromise = new Promise<{ data: null; error: { message: string } }>((_, reject) => 
          setTimeout(() => reject(new Error('查詢超時（8秒）')), 8000)
        );
        
        let queryResult: { data: any; error: any };
        try {
          queryResult = await Promise.race([
            queryPromise,
            timeoutPromise
          ]) as { data: any; error: any };
        } catch (timeoutError: any) {
          console.error('[useAdmin] Direct query timeout:', timeoutError);
          // 查詢超時時，預設為非管理員（更安全）
          return false;
        }

        const { data, error: queryError } = queryResult;

        console.log('[useAdmin] Direct query response:', { data, queryError });

        if (queryError) {
          console.error('[useAdmin] Direct query error:', queryError);
          // 查詢失敗時，預設為非管理員（更安全）
          return false;
        }

        const result = !!data;
        console.log('[useAdmin] Admin status result (direct query):', result);
        return result;
      } catch (err) {
        console.error('[useAdmin] Exception checking admin status:', err);
        // 發生異常時，預設為非管理員（更安全）
        return false;
      }
    },
    enabled: !!user?.id && !authLoading, // 等待 auth 載入完成
    retry: 2, // 減少重試次數（從3次改為2次）
    staleTime: 60000, // 使用60秒快取，避免頻繁查詢
    refetchOnWindowFocus: false, // 關閉視窗聚焦時重新查詢（減少不必要的查詢）
    refetchOnMount: true, // 組件掛載時重新查詢
    gcTime: 300000, // 5分鐘後清除快取
  });

  console.log('[useAdmin] Query state:', { 
    isAdmin, 
    isLoading, 
    error,
    enabled: !!user?.id && !authLoading,
    hasUser: !!user,
    userId: user?.id,
    authLoading
  });

  // 如果 auth 還在載入，isLoading 應該為 true
  const finalLoading = authLoading || isLoading;

  // 重要：在網頁版，如果查詢失敗或沒有執行，預設為非管理員（更安全）
  // 但只有在查詢完成後（不是 undefined）才返回結果
  // 如果查詢已經完成（!isLoading）但結果是 undefined，表示查詢失敗，預設為 false
  let result: boolean | undefined;
  if (isLoading) {
    result = undefined; // 還在載入中
  } else if (isAdmin !== undefined) {
    result = isAdmin; // 有明確結果
  } else {
    // 查詢完成但沒有結果（可能是查詢失敗或沒有執行）
    // 在網頁版，預設為非管理員（更安全）
    result = false;
    if (typeof window !== 'undefined') {
      window.console?.warn?.('[useAdmin] Query completed but result is undefined, defaulting to false (non-admin)');
    }
  }

  // 強制輸出最終結果
  if (typeof window !== 'undefined' && user?.id) {
    window.console?.log?.('[useAdmin] Final result:', { 
      userId: user.id, 
      isAdmin: result, 
      isLoading: finalLoading,
      queryEnabled: !!user?.id && !authLoading
    });
  }

  return { 
    isAdmin: result,
    isLoading: finalLoading,
    error 
  };
};
