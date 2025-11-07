import { supabase } from "@/integrations/supabase/client";

/**
 * 錯誤等級
 */
export enum ErrorLevel {
  INFO = 'info',
  WARNING = 'warning',
  ERROR = 'error',
  CRITICAL = 'critical',
}

/**
 * 錯誤類型
 */
export enum ErrorType {
  NETWORK = 'network',
  API = 'api',
  RENDER = 'render',
  AUTH = 'auth',
  VALIDATION = 'validation',
  UNKNOWN = 'unknown',
}

/**
 * 錯誤日誌介面
 */
export interface ErrorLog {
  level: ErrorLevel;
  type: ErrorType;
  message: string;
  stack?: string;
  context?: Record<string, any>;
  userAgent?: string;
  url?: string;
  timestamp: string;
}

/**
 * 獲取客戶端資訊
 */
const getClientInfo = () => {
  return {
    userAgent: navigator.userAgent,
    url: window.location.href,
    platform: navigator.platform,
    language: navigator.language,
    screenResolution: `${window.screen.width}x${window.screen.height}`,
    viewport: `${window.innerWidth}x${window.innerHeight}`,
  };
};

/**
 * 判斷錯誤類型
 */
const detectErrorType = (error: any): ErrorType => {
  const message = error.message?.toLowerCase() || '';
  
  if (message.includes('fetch') || message.includes('network')) {
    return ErrorType.NETWORK;
  }
  
  if (message.includes('unauthorized') || message.includes('auth')) {
    return ErrorType.AUTH;
  }
  
  if (message.includes('validation') || message.includes('invalid')) {
    return ErrorType.VALIDATION;
  }
  
  if (error.status) {
    return ErrorType.API;
  }
  
  return ErrorType.UNKNOWN;
};

/**
 * 記錄錯誤到控制台
 */
const logToConsole = (log: ErrorLog) => {
  const prefix = `[${log.level.toUpperCase()}] [${log.type}]`;
  const message = `${prefix} ${log.message}`;
  
  switch (log.level) {
    case ErrorLevel.INFO:
      console.info(message, log);
      break;
    case ErrorLevel.WARNING:
      console.warn(message, log);
      break;
    case ErrorLevel.ERROR:
    case ErrorLevel.CRITICAL:
      console.error(message, log);
      break;
  }
};

/**
 * 記錄錯誤到資料庫（審計日誌）
 */
const logToDatabase = async (log: ErrorLog) => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    
    await supabase.from('audit_logs').insert({
      user_id: user?.id,
      action: `error_${log.type}`,
      details: {
        level: log.level,
        message: log.message,
        stack: log.stack,
        context: log.context,
        clientInfo: getClientInfo(),
      },
    });
  } catch (error) {
    // 記錄錯誤失敗，只在控制台輸出
    console.error('Failed to log error to database:', error);
  }
};

/**
 * 記錄錯誤到 localStorage（離線備份）
 */
const logToLocalStorage = (log: ErrorLog) => {
  try {
    const key = 'error_logs';
    const existingLogs = JSON.parse(localStorage.getItem(key) || '[]');
    
    // 只保留最近 50 條
    const logs = [...existingLogs, log].slice(-50);
    
    localStorage.setItem(key, JSON.stringify(logs));
  } catch (error) {
    console.error('Failed to log to localStorage:', error);
  }
};

/**
 * 主要錯誤記錄函數
 */
export const logError = async (
  error: any,
  level: ErrorLevel = ErrorLevel.ERROR,
  type?: ErrorType,
  context?: Record<string, any>
): Promise<void> => {
  const errorLog: ErrorLog = {
    level,
    type: type || detectErrorType(error),
    message: error.message || String(error),
    stack: error.stack,
    context: {
      ...context,
      errorName: error.name,
      errorCode: error.code,
    },
    userAgent: navigator.userAgent,
    url: window.location.href,
    timestamp: new Date().toISOString(),
  };

  // 1. 記錄到控制台（開發環境）
  if (import.meta.env.DEV) {
    logToConsole(errorLog);
  }

  // 2. 記錄到 localStorage（離線備份）
  logToLocalStorage(errorLog);

  // 3. 記錄到資料庫（Critical 和 Error 級別）
  if (level === ErrorLevel.CRITICAL || level === ErrorLevel.ERROR) {
    await logToDatabase(errorLog);
  }

  // TODO: 4. 記錄到 Sentry 或其他錯誤追蹤服務
  // if (import.meta.env.PROD) {
  //   Sentry.captureException(error, {
  //     level: level,
  //     tags: { type: errorLog.type },
  //     contexts: { custom: context }
  //   });
  // }
};

/**
 * 快捷記錄函數
 */
export const ErrorLogger = {
  info: (message: string, context?: Record<string, any>) => 
    logError({ message }, ErrorLevel.INFO, ErrorType.UNKNOWN, context),
    
  warning: (message: string, context?: Record<string, any>) => 
    logError({ message }, ErrorLevel.WARNING, ErrorType.UNKNOWN, context),
    
  error: (error: any, context?: Record<string, any>) => 
    logError(error, ErrorLevel.ERROR, undefined, context),
    
  critical: (error: any, context?: Record<string, any>) => 
    logError(error, ErrorLevel.CRITICAL, undefined, context),
    
  network: (error: any, context?: Record<string, any>) => 
    logError(error, ErrorLevel.ERROR, ErrorType.NETWORK, context),
    
  api: (error: any, context?: Record<string, any>) => 
    logError(error, ErrorLevel.ERROR, ErrorType.API, context),
    
  auth: (error: any, context?: Record<string, any>) => 
    logError(error, ErrorLevel.ERROR, ErrorType.AUTH, context),
};

/**
 * 獲取本地錯誤日誌
 */
export const getLocalErrorLogs = (): ErrorLog[] => {
  try {
    const logs = localStorage.getItem('error_logs');
    return logs ? JSON.parse(logs) : [];
  } catch (error) {
    console.error('Failed to get local error logs:', error);
    return [];
  }
};

/**
 * 清除本地錯誤日誌
 */
export const clearLocalErrorLogs = (): void => {
  try {
    localStorage.removeItem('error_logs');
  } catch (error) {
    console.error('Failed to clear local error logs:', error);
  }
};

/**
 * 全局錯誤處理器
 */
export const setupGlobalErrorHandlers = () => {
  // 捕獲未處理的 Promise 錯誤
  window.addEventListener('unhandledrejection', (event) => {
    console.error('Unhandled promise rejection:', event.reason);
    logError(event.reason, ErrorLevel.ERROR, ErrorType.UNKNOWN, {
      type: 'unhandledRejection',
      promise: String(event.promise),
    });
  });

  // 捕獲全局錯誤
  window.addEventListener('error', (event) => {
    console.error('Global error:', event.error);
    logError(event.error || event.message, ErrorLevel.ERROR, ErrorType.UNKNOWN, {
      type: 'globalError',
      filename: event.filename,
      lineno: event.lineno,
      colno: event.colno,
    });
  });

  console.log('Global error handlers set up');
};

/**
 * 使用範例：
 * 
 * // 1. 簡單記錄
 * try {
 *   await fetchData();
 * } catch (error) {
 *   ErrorLogger.error(error);
 * }
 * 
 * // 2. 帶上下文記錄
 * try {
 *   await castVote(topicId, option, amount);
 * } catch (error) {
 *   ErrorLogger.error(error, { topicId, option, amount });
 * }
 * 
 * // 3. 不同等級
 * ErrorLogger.info('User logged in');
 * ErrorLogger.warning('API slow response');
 * ErrorLogger.error(error);
 * ErrorLogger.critical(criticalError);
 */

export default ErrorLogger;


