import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { useCallback, useMemo, useEffect, useRef, useState } from "react";

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

        // 方法2：直接查詢 admin_users 表（15秒超時，快速失敗）
        console.log('[useAdmin] Attempting direct query...');

        const queryPromise = supabase
          .from('admin_users')
          .select('user_id')
          .eq('user_id', user.id)
          .maybeSingle();

        const timeoutPromise = new Promise<{ data: null; error: { message: string } }>((_, reject) =>
          setTimeout(() => reject(new Error('查詢超時（15秒）')), 15000)
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

  // 計算最終的 isAdmin 結果（用於 isSuperAdmin 查詢的 enabled 條件）
  // 簡化邏輯：直接使用 result 和 isAdmin，確保查詢能正確執行
  const finalIsAdmin = useMemo(() => {
    // 優先使用查詢結果
    if (isAdmin === true) {
      console.log('[useAdmin] finalIsAdmin: isAdmin=true, returning true');
      return true;
    } else if (isAdmin === false) {
      console.log('[useAdmin] finalIsAdmin: isAdmin=false, returning false');
      return false;
    } else if (result === true) {
      // 如果 isAdmin 是 undefined 但 result 是 true（來自快取）
      console.log('[useAdmin] finalIsAdmin: isAdmin=undefined, result=true, returning true');
      return true;
    } else {
      console.log('[useAdmin] finalIsAdmin: no admin status, returning false');
      return false;
    }
  }, [isAdmin, result]);

  // 計算 enabled 條件（必須在 useQuery 之前計算，以便 React Query 能正確追蹤依賴）
  // 簡化邏輯：直接使用 result 和 isAdmin
  const isSuperAdminQueryEnabled = useMemo(() => {
    // 確保用戶已登入、auth 已載入、isAdmin 查詢已完成且結果為 true
    const enabled = !!user?.id && !authLoading && !isLoading && (isAdmin === true || result === true);
    console.log('[useAdmin] 🔧 isSuperAdminQueryEnabled calculation:', {
      hasUserId: !!user?.id,
      userId: user?.id,
      notAuthLoading: !authLoading,
      authLoading,
      notIsLoading: !isLoading,
      isLoading,
      isAdmin,
      result,
      enabled
    });
    return enabled;
  }, [user?.id, authLoading, isLoading, isAdmin, result]);

  // 使用 ref 來追蹤查詢結果，避免狀態更新延遲問題
  const isSuperAdminRef = useRef<boolean>(false);
  const [isSuperAdminState, setIsSuperAdminState] = useState<boolean>(false);

  // 檢查是否為最高管理者（只有確認是管理員後才檢查）
  const {
    data: isSuperAdminData,
    isLoading: isSuperAdminLoading,
    status: isSuperAdminStatus,
    fetchStatus: isSuperAdminFetchStatus,
    error: isSuperAdminError
  } = useQuery({
    queryKey: ['super-admin-status', user?.id],
    queryFn: async () => {
      if (!user?.id) {
        console.log('[useAdmin] 🔍 No user ID, returning false');
        return false;
      }

      console.log('[useAdmin] 🔍 Checking super admin status for user:', user.id);

      try {
        const { data, error } = await supabase.rpc('is_super_admin', {
          check_user_id: user.id
        });

        if (error) {
          console.warn('[useAdmin] ❌ Error checking super admin status:', error);
          return false;
        }

        const isSuper = !!data;
        console.log('[useAdmin] ✅ Super admin status result:', isSuper, 'Raw data:', data);

        // 立即更新 ref 和 state
        if (isSuper) {
          isSuperAdminRef.current = true;
          setIsSuperAdminState(true);
          console.log('[useAdmin] 🔄 Immediately set isSuperAdmin to true');
        }

        return isSuper;
      } catch (err) {
        console.error('[useAdmin] ❌ Exception checking super admin status:', err);
        return false;
      }
    },
    // 使用計算好的 enabled 條件
    enabled: isSuperAdminQueryEnabled,
    retry: 1,
    staleTime: 300000,
    refetchOnWindowFocus: false,
    // 保持之前的數據，即使 enabled 變成 false
    keepPreviousData: true,
    // 當查詢被禁用時，保持最後的數據
    gcTime: Infinity, // 永遠不清理緩存
  });

  // 當查詢數據更新時，更新 ref 和 state
  useEffect(() => {
    if (isSuperAdminData === true) {
      console.log('[useAdmin] 🔄 isSuperAdminData updated to true');
      isSuperAdminRef.current = true;
      setIsSuperAdminState(true);
    } else if (isSuperAdminData === false) {
      // 只有在 ref 也是 false 時才更新，避免覆蓋之前的 true
      if (isSuperAdminRef.current === false) {
        console.log('[useAdmin] 🔄 isSuperAdminData updated to false (ref was already false)');
        setIsSuperAdminState(false);
      } else {
        console.log('[useAdmin] 🔄 isSuperAdminData is false but ref is true, keeping true');
      }
    }
  }, [isSuperAdminData]);

  // 確保 isSuperAdmin 有正確的值
  // 優先使用查詢數據，如果查詢數據是 true，直接返回 true
  // 如果查詢數據是 false，檢查 ref 是否為 true（可能是之前的查詢結果）
  // 如果查詢數據是 undefined，使用 state 或 ref
  const isSuperAdmin = useMemo(() => {
    if (isSuperAdminData === true) {
      return true;
    } else if (isSuperAdminData === false) {
      // 如果查詢返回 false，但 ref 是 true，可能是查詢被重置了，使用 ref
      return isSuperAdminRef.current || false;
    } else {
      // 查詢數據是 undefined，使用 state 或 ref
      return isSuperAdminState || isSuperAdminRef.current || false;
    }
  }, [isSuperAdminData, isSuperAdminState]);

  // 調試日誌：檢查 isSuperAdmin 查詢狀態
  console.log('[useAdmin] 📊 isSuperAdmin query state:', {
    userId: user?.id,
    authLoading,
    isLoading,
    isAdmin,
    cachedStatus,
    result,
    finalIsAdmin,
    finalIsAdminType: typeof finalIsAdmin,
    isSuperAdminData, // 原始查詢數據
    isSuperAdminRefCurrent: isSuperAdminRef.current, // Ref 中的值
    isSuperAdmin, // 處理後的值
    isSuperAdminType: typeof isSuperAdmin,
    isSuperAdminStatus, // React Query status: 'pending' | 'error' | 'success'
    isSuperAdminFetchStatus, // React Query fetchStatus: 'fetching' | 'paused' | 'idle'
    isSuperAdminLoading,
    isSuperAdminError,
    enabled: isSuperAdminQueryEnabled,
    enabledBreakdown: {
      hasUserId: !!user?.id,
      notAuthLoading: !authLoading,
      notIsLoading: !isLoading,
      finalIsAdminTrue: finalIsAdmin === true,
      finalIsAdminValue: finalIsAdmin
    }
  });

  // 如果應該啟用但查詢沒有執行，記錄警告
  if (isSuperAdminQueryEnabled && isSuperAdminData === undefined && !isSuperAdminLoading && isSuperAdminStatus !== 'pending') {
    console.warn('[useAdmin] ⚠️ isSuperAdmin should be enabled but query not running. Status:', isSuperAdminStatus, 'FetchStatus:', isSuperAdminFetchStatus);
  }

  // 強制輸出最終結果
  if (typeof window !== 'undefined' && user?.id) {
    window.console?.log?.('[useAdmin] Final result:', {
      userId: user.id,
      isAdmin: result,
      isLoading: finalLoading,
      queryEnabled: !!user?.id && !authLoading,
      cachedStatus,
      isSuperAdmin
    });
  }

  return {
    isAdmin: result,
    isSuperAdmin: isSuperAdmin || false,
    isLoading: finalLoading,
    error
  };
};
