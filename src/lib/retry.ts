/**
 * 網路請求重試工具
 * 提供自動重試機制，處理暫時性網路錯誤
 */

export interface RetryOptions {
  /**
   * 最大重試次數
   * @default 3
   */
  maxRetries?: number;

  /**
   * 初始延遲時間（毫秒）
   * @default 1000
   */
  initialDelay?: number;

  /**
   * 延遲倍數（指數退避）
   * @default 2
   */
  backoffMultiplier?: number;

  /**
   * 最大延遲時間（毫秒）
   * @default 10000
   */
  maxDelay?: number;

  /**
   * 判斷是否應該重試的函數
   * @default 檢查是否為網路錯誤
   */
  shouldRetry?: (error: any) => boolean;

  /**
   * 每次重試前的回調
   */
  onRetry?: (attempt: number, error: any) => void;
}

/**
 * 預設的重試判斷邏輯
 */
const defaultShouldRetry = (error: any): boolean => {
  // 網路錯誤
  if (error.message?.includes('fetch') || error.message?.includes('network')) {
    return true;
  }

  // HTTP 狀態碼 5xx（伺服器錯誤）
  if (error.status >= 500 && error.status < 600) {
    return true;
  }

  // 超時錯誤
  if (error.message?.includes('timeout')) {
    return true;
  }

  // 429 Too Many Requests（可以重試）
  if (error.status === 429) {
    return true;
  }

  // 其他錯誤不重試（如 4xx 客戶端錯誤）
  return false;
};

/**
 * 計算延遲時間（指數退避）
 */
const calculateDelay = (
  attempt: number,
  initialDelay: number,
  backoffMultiplier: number,
  maxDelay: number
): number => {
  const delay = initialDelay * Math.pow(backoffMultiplier, attempt);
  return Math.min(delay, maxDelay);
};

/**
 * 延遲執行
 */
const sleep = (ms: number): Promise<void> => {
  return new Promise(resolve => setTimeout(resolve, ms));
};

/**
 * 重試執行異步函數
 * @param fn 要執行的異步函數
 * @param options 重試選項
 * @returns 函數執行結果
 */
export const retryAsync = async <T,>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> => {
  const {
    maxRetries = 3,
    initialDelay = 1000,
    backoffMultiplier = 2,
    maxDelay = 10000,
    shouldRetry = defaultShouldRetry,
    onRetry,
  } = options;

  let lastError: any;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      // 嘗試執行函數
      const result = await fn();
      return result;
    } catch (error) {
      lastError = error;

      // 如果是最後一次嘗試，直接拋出錯誤
      if (attempt === maxRetries) {
        throw error;
      }

      // 檢查是否應該重試
      if (!shouldRetry(error)) {
        throw error;
      }

      // 計算延遲時間
      const delay = calculateDelay(attempt, initialDelay, backoffMultiplier, maxDelay);

      // 調用重試回調
      if (onRetry) {
        onRetry(attempt + 1, error);
      }

      console.log(`Retry attempt ${attempt + 1}/${maxRetries} after ${delay}ms`, error);

      // 等待後重試
      await sleep(delay);
    }
  }

  // 應該不會到達這裡，但為了 TypeScript
  throw lastError;
};

/**
 * 創建帶重試的 fetch 包裝器
 */
export const fetchWithRetry = async (
  url: string,
  init?: RequestInit,
  retryOptions?: RetryOptions
): Promise<Response> => {
  return retryAsync(
    () => fetch(url, init),
    retryOptions
  );
};

/**
 * 創建帶重試的 Supabase 請求包裝器
 */
export const supabaseWithRetry = async <T,>(
  fn: () => Promise<{ data: T | null; error: any }>,
  retryOptions?: RetryOptions
): Promise<{ data: T | null; error: any }> => {
  return retryAsync(
    async () => {
      const result = await fn();
      
      // 如果有錯誤，拋出以觸發重試
      if (result.error) {
        throw result.error;
      }
      
      return result;
    },
    {
      ...retryOptions,
      shouldRetry: (error) => {
        // Supabase 特定錯誤處理
        if (error.message?.includes('Failed to fetch')) {
          return true;
        }
        
        // 使用預設邏輯
        return retryOptions?.shouldRetry?.(error) ?? defaultShouldRetry(error);
      }
    }
  );
};

/**
 * Hook: 使用重試機制
 */
export const useRetry = (options?: RetryOptions) => {
  const retry = async <T,>(fn: () => Promise<T>): Promise<T> => {
    return retryAsync(fn, options);
  };

  return { retry };
};

/**
 * 使用範例：
 * 
 * // 1. 直接使用
 * const data = await retryAsync(
 *   () => fetchData(),
 *   {
 *     maxRetries: 3,
 *     onRetry: (attempt) => console.log(`重試第 ${attempt} 次`)
 *   }
 * );
 * 
 * // 2. 使用 Hook
 * const { retry } = useRetry({ maxRetries: 5 });
 * const data = await retry(() => fetchData());
 * 
 * // 3. Supabase 請求
 * const result = await supabaseWithRetry(
 *   () => supabase.from('topics').select('*')
 * );
 */


