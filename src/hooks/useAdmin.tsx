import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { useCallback, useMemo } from "react";

// 本地快取鍵名
const ADMIN_CACHE_KEY = 'admin_status_cache';
const ADMIN_CACHE_EXPIRY = 5 * 60 * 1000; // 5分鐘過期

interface AdminCache {
  userId: string;
  isAdmin: boolean;
  timestamp: number;
}

// 從 localStorage 讀取快取
const getCachedAdminStatus = (userId: string | undefined): boolean | null => {
  if (!userId || typeof window === 'undefined') return null;
  
  try {
    const cached = localStorage.getItem(ADMIN_CACHE_KEY);
    if (!cached) return null;
    
    const cache: AdminCache = JSON.parse(cached);
    
    // 檢查是否過期或用戶ID不匹配
    const now = Date.now();
    if (now - cache.timestamp > ADMIN_CACHE_EXPIRY || cache.userId !== userId) {
      localStorage.removeItem(ADMIN_CACHE_KEY);
      return null;
    }
    
    return cache.isAdmin;
  } catch (error) {
    console.warn('[useAdmin] Failed to read cache:', error);
    return null;
  }
};

// 保存到 localStorage
const setCachedAdminStatus = (userId: string, isAdmin: boolean): void => {
  if (typeof window === 'undefined') return;
  
  try {
    const cache: AdminCache = {
      userId,
      isAdmin,
      timestamp: Date.now()
    };
    localStorage.setItem(ADMIN_CACHE_KEY, JSON.stringify(cache));
  } catch (error) {
    console.warn('[useAdmin] Failed to save cache:', error);
  }
};

export const useAdmin = () => {
  const { user, loading: authLoading } = useAuth();

  // 從快取讀取初始值
  const cachedStatus = useMemo(() => getCachedAdminStatus(user?.id), [user?.id]);

  // 強制輸出日誌（即使被壓縮也會保留）
  if (typeof window !== 'undefined') {
    window.console?.log?.('[useAdmin] Hook called:', { 
      hasUser: !!user, 
      userId: user?.id, 
      authLoading,
      cachedStatus
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
      
      // 快速查詢策略：先嘗試 RPC，如果失敗立即使用直接查詢，不等待超時
      try {
        // 方法1：嘗試 RPC 函數（5秒超時，快速失敗）
        try {
          console.log('[useAdmin] Attempting RPC call...');
          
          const rpcPromise = supabase.rpc('is_admin', { check_user_id: user.id });
          const timeoutPromise = new Promise<{ data: null; error: { message: string } }>((_, reject) => 
            setTimeout(() => reject(new Error('RPC 查詢超時（5秒）')), 5000)
          );
          
          let rpcResult: { data: any; error: any };
          try {
            rpcResult = await Promise.race([
              rpcPromise,
              timeoutPromise
            ]) as { data: any; error: any };
          } catch (timeoutError: any) {
            console.warn('[useAdmin] RPC timeout, trying direct query:', timeoutError);
            // 不拋出錯誤，繼續嘗試直接查詢
          }
          
          const { data: rpcData, error: rpcError } = rpcResult || { data: null, error: null };
          
          console.log('[useAdmin] RPC response:', { rpcData, rpcError });
          
          if (!rpcError && rpcData !== null && rpcData !== undefined) {
            const result = !!rpcData;
            console.log('[useAdmin] Admin status (via RPC):', result);
            // 保存到快取
            setCachedAdminStatus(user.id, result);
            return result;
          }
          
          if (rpcError) {
            console.warn('[useAdmin] RPC error, trying direct query:', rpcError);
          }
        } catch (rpcErr) {
          console.warn('[useAdmin] RPC exception, trying direct query:', rpcErr);
        }

        // 方法2：直接查詢 admin_users 表（5秒超時，快速失敗）
        console.log('[useAdmin] Attempting direct query...');
        
        const queryPromise = supabase
          .from('admin_users')
          .select('user_id')
          .eq('user_id', user.id)
          .maybeSingle();
        
        const timeoutPromise = new Promise<{ data: null; error: { message: string } }>((_, reject) => 
          setTimeout(() => reject(new Error('查詢超時（5秒）')), 5000)
        );
        
        let queryResult: { data: any; error: any };
        try {
          queryResult = await Promise.race([
            queryPromise,
            timeoutPromise
          ]) as { data: any; error: any };
        } catch (timeoutError: any) {
          console.error('[useAdmin] Direct query timeout:', timeoutError);
          // 查詢超時時，使用快取值（如果存在）
          if (cachedStatus !== null) {
            console.log('[useAdmin] Using cached admin status due to timeout:', cachedStatus);
            return cachedStatus;
          }
          // 沒有快取時，預設為非管理員（更安全）
          return false;
        }

        const { data, error: queryError } = queryResult;

        console.log('[useAdmin] Direct query response:', { data, queryError });

        if (queryError) {
          console.error('[useAdmin] Direct query error:', queryError);
          // 查詢失敗時，使用快取值（如果存在）
          if (cachedStatus !== null) {
            console.log('[useAdmin] Using cached admin status due to query error:', cachedStatus);
            return cachedStatus;
          }
          // 查詢失敗時，預設為非管理員（更安全）
          return false;
        }

        const result = !!data;
        console.log('[useAdmin] Admin status result (direct query):', result);
        // 保存到快取
        setCachedAdminStatus(user.id, result);
        return result;
      } catch (err) {
        console.error('[useAdmin] Exception checking admin status:', err);
        // 發生異常時，使用快取值（如果存在）
        if (cachedStatus !== null) {
          console.log('[useAdmin] Using cached admin status due to exception:', cachedStatus);
          return cachedStatus;
        }
        // 發生異常時，預設為非管理員（更安全）
        return false;
      }
    },
    enabled: !!user?.id && !authLoading, // 等待 auth 載入完成
    retry: 1, // 只重試1次（減少等待時間）
    staleTime: 300000, // 5分鐘內不重新查詢（使用快取）
    refetchOnWindowFocus: false, // 關閉視窗聚焦時重新查詢
    refetchOnMount: false, // 關閉組件掛載時重新查詢（使用快取）
    gcTime: 600000, // 10分鐘後清除快取
    // 使用快取作為初始值
    initialData: cachedStatus !== null ? cachedStatus : undefined,
    // 如果快取存在且未過期，直接使用快取，不進行查詢
    placeholderData: cachedStatus !== null ? cachedStatus : undefined,
  });

  console.log('[useAdmin] Query state:', { 
    isAdmin, 
    isLoading, 
    error,
    enabled: !!user?.id && !authLoading,
    hasUser: !!user,
    userId: user?.id,
    authLoading,
    cachedStatus
  });

  // 如果 auth 還在載入，isLoading 應該為 true
  const finalLoading = authLoading || isLoading;

  // 重要：優先使用查詢結果，如果查詢還在進行且有快取，使用快取
  let result: boolean | undefined;
  if (isLoading && cachedStatus !== null) {
    // 查詢中但有快取，使用快取（優化體驗）
    result = cachedStatus;
    console.log('[useAdmin] Using cached status while querying:', cachedStatus);
  } else if (isLoading) {
    result = undefined; // 還在載入中且無快取
  } else if (isAdmin !== undefined) {
    result = isAdmin; // 有明確結果
  } else {
    // 查詢完成但沒有結果（可能是查詢失敗或沒有執行）
    // 如果有快取，使用快取
    if (cachedStatus !== null) {
      result = cachedStatus;
      console.log('[useAdmin] Using cached status as fallback:', cachedStatus);
    } else {
      // 在網頁版，預設為非管理員（更安全）
      result = false;
      if (typeof window !== 'undefined') {
        window.console?.warn?.('[useAdmin] Query completed but result is undefined, defaulting to false (non-admin)');
      }
    }
  }

  // 強制輸出最終結果
  if (typeof window !== 'undefined' && user?.id) {
    window.console?.log?.('[useAdmin] Final result:', { 
      userId: user.id, 
      isAdmin: result, 
      isLoading: finalLoading,
      queryEnabled: !!user?.id && !authLoading,
      cachedStatus
    });
  }

  return { 
    isAdmin: result,
    isLoading: finalLoading,
    error 
  };
};
