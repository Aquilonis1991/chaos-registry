import React, { useState, useCallback } from 'react';

/**
 * 防止異步操作重複執行的 Hook
 * 用於防止按鈕重複點擊、表單重複提交等
 */
export const useAsyncAction = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  // 使用 useRef 來追蹤 loading 狀態，避免依賴問題
  const loadingRef = React.useRef(false);

  const execute = useCallback(async <T,>(
    action: () => Promise<T>,
    options?: {
      onSuccess?: (result: T) => void;
      onError?: (error: Error) => void;
      onFinally?: () => void;
    }
  ): Promise<T | null> => {
    // 如果正在執行，直接返回（使用 ref 檢查，避免閉包問題）
    if (loadingRef.current) {
      console.warn('Action already in progress, skipping');
      return null;
    }

    loadingRef.current = true;
    setLoading(true);
    setError(null);

    try {
      const result = await action();
      options?.onSuccess?.(result);
      return result;
    } catch (err: any) {
      const error = err instanceof Error ? err : new Error(String(err));
      setError(error);
      options?.onError?.(error);
      return null;
    } finally {
      loadingRef.current = false;
      setLoading(false);
      options?.onFinally?.();
    }
  }, []); // 移除 loading 依賴，使用 ref 來追蹤狀態

  const reset = useCallback(() => {
    setLoading(false);
    setError(null);
  }, []);

  return { 
    execute, 
    loading, 
    error,
    reset 
  };
};

/**
 * 使用範例：
 * 
 * const { execute, loading } = useAsyncAction();
 * 
 * <Button 
 *   onClick={() => execute(
 *     () => castVote(topicId, option, amount),
 *     {
 *       onSuccess: () => toast.success('投票成功'),
 *       onError: (error) => toast.error(error.message)
 *     }
 *   )}
 *   disabled={loading}
 * >
 *   {loading ? '處理中...' : '確認投票'}
 * </Button>
 */


