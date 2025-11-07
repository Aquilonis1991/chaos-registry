import DOMPurify from 'dompurify';

/**
 * 清理用戶輸入，移除所有 HTML 標籤和腳本
 * @param input 用戶輸入的字串
 * @returns 清理後的安全字串
 */
export const sanitizeInput = (input: string): string => {
  if (!input) return '';
  
  return DOMPurify.sanitize(input, {
    ALLOWED_TAGS: [], // 不允許任何 HTML 標籤
    ALLOWED_ATTR: [], // 不允許任何屬性
    KEEP_CONTENT: true, // 保留文字內容
  }).trim();
};

/**
 * 清理 HTML 內容，允許部分安全標籤（未來留言功能可能需要）
 * @param html HTML 字串
 * @returns 清理後的 HTML
 */
export const sanitizeHTML = (html: string): string => {
  if (!html) return '';
  
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'a', 'p', 'br'],
    ALLOWED_ATTR: ['href', 'target'],
    ALLOW_DATA_ATTR: false,
  });
};

/**
 * 清理主題標題
 * @param title 主題標題
 * @returns 清理後的標題
 */
export const sanitizeTopicTitle = (title: string): string => {
  const cleaned = sanitizeInput(title);
  
  // 移除多餘空白
  return cleaned.replace(/\s+/g, ' ').trim();
};

/**
 * 清理標籤
 * @param tags 標籤陣列
 * @returns 清理後的標籤陣列
 */
export const sanitizeTags = (tags: string[]): string[] => {
  return tags
    .map(tag => sanitizeInput(tag))
    .filter(tag => tag.length > 0)
    .slice(0, 5); // 最多 5 個標籤
};

/**
 * 驗證 Email 格式
 * @param email Email 字串
 * @returns 是否為有效的 Email
 */
export const isValidEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

/**
 * 驗證密碼強度
 * @param password 密碼字串
 * @returns 驗證結果物件
 */
export const validatePasswordStrength = (password: string): {
  valid: boolean;
  errors: string[];
  strength: 'weak' | 'medium' | 'strong';
} => {
  const errors: string[] = [];
  
  if (password.length < 8) {
    errors.push('密碼至少需要 8 個字元');
  }
  
  if (!/[A-Z]/.test(password)) {
    errors.push('密碼需要包含至少一個大寫字母');
  }
  
  if (!/[a-z]/.test(password)) {
    errors.push('密碼需要包含至少一個小寫字母');
  }
  
  if (!/[0-9]/.test(password)) {
    errors.push('密碼需要包含至少一個數字');
  }
  
  // 計算強度
  let strengthScore = 0;
  if (password.length >= 8) strengthScore++;
  if (password.length >= 12) strengthScore++;
  if (/[A-Z]/.test(password)) strengthScore++;
  if (/[a-z]/.test(password)) strengthScore++;
  if (/[0-9]/.test(password)) strengthScore++;
  if (/[^A-Za-z0-9]/.test(password)) strengthScore++;
  
  let strength: 'weak' | 'medium' | 'strong' = 'weak';
  if (strengthScore >= 5) strength = 'strong';
  else if (strengthScore >= 3) strength = 'medium';
  
  return {
    valid: errors.length === 0,
    errors,
    strength
  };
};

/**
 * 防止 SQL 注入（雖然 Supabase 已防護，但雙重保險）
 * @param input 用戶輸入
 * @returns 清理後的輸入
 */
export const sanitizeSQLInput = (input: string): string => {
  // 移除常見的 SQL 注入字符
  return input
    .replace(/[';\"\\]/g, '') // 移除引號和反斜線
    .replace(/--/g, '') // 移除 SQL 註解
    .replace(/\/\*/g, '') // 移除多行註解
    .replace(/\*\//g, '')
    .trim();
};


