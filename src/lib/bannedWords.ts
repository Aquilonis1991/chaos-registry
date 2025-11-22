/**
 * 禁字表驗證工具
 * 用於前端和後端的內容驗證
 */

import { supabase } from "@/integrations/supabase/client";

export interface BannedWordCheckResult {
  found: boolean;
  level?: string;
  keyword?: string;
  action?: 'block' | 'mask' | 'review';
  category?: string;
  errorMessage?: string;
}

/**
 * 檢查文本是否包含禁字
 * @param text 要檢查的文本
 * @param checkLevels 要檢查的級別（預設檢查所有級別）
 * @returns 檢查結果
 */
export const checkBannedWords = async (
  text: string,
  checkLevels: string[] = ['A', 'B', 'C', 'D', 'E', 'F']
): Promise<BannedWordCheckResult> => {
  if (!text || !text.trim()) {
    return { found: false };
  }

  try {
    const { data, error } = await (supabase.rpc as any)('check_banned_words', {
      p_text: text,
      p_check_levels: checkLevels
    });

    if (error) {
      console.error('Error checking banned words:', error);
      return { found: false }; // 發生錯誤時不阻擋（避免系統故障影響用戶）
    }

    if (data && data.length > 0 && data[0].found) {
      return {
        found: true,
        level: data[0].level,
        keyword: data[0].keyword,
        action: data[0].action as 'block' | 'mask' | 'review',
        category: data[0].category,
        errorMessage: `內容包含不當字詞：${data[0].keyword}`
      };
    }

    return { found: false };
  } catch (error) {
    console.error('Exception checking banned words:', error);
    return { found: false }; // 發生錯誤時不阻擋
  }
};

/**
 * 驗證主題內容（標題、描述、選項、標籤、分類）
 */
export const validateTopicContent = async (
  title: string,
  description?: string | null,
  options?: Array<{ text: string }> | string[],
  tags?: string[],
  category?: string,
  checkLevels: string[] = ['A', 'B', 'C', 'D', 'E', 'F']
): Promise<BannedWordCheckResult> => {
  try {
    const textBlocks: Array<{ content: string; type: string }> = [];

    if (title) {
      textBlocks.push({ content: title, type: 'title' });
    }

    if (description) {
      textBlocks.push({ content: description, type: 'description' });
    }

    if (options && options.length > 0) {
      const optionTexts = typeof options[0] === 'string'
        ? options as string[]
        : (options as Array<{ text: string }>).map(opt => opt.text);

      optionTexts.forEach(opt => {
        if (opt) {
          textBlocks.push({ content: opt, type: 'option' });
        }
      });
    }

    if (tags && tags.length > 0) {
      tags.forEach(tag => {
        if (tag) {
          textBlocks.push({ content: tag, type: 'tag' });
        }
      });
    }

    if (category) {
      textBlocks.push({ content: category, type: 'category' });
    }

    for (const block of textBlocks) {
      const result = await checkBannedWords(block.content, checkLevels);
      if (result.found) {
        return {
          ...result,
          errorMessage: result.errorMessage || `內容包含不當字詞（區塊：${block.type}）`
        };
      }
    }

    return { found: false };
  } catch (error) {
    console.error('Exception validating topic content:', error);
    return { found: false };
  }
};

/**
 * 驗證用戶名稱
 */
export const validateNickname = async (
  nickname: string,
  checkLevels: string[] = ['A', 'B', 'C', 'D', 'E', 'F']
): Promise<BannedWordCheckResult> => {
  const trimmedNickname = (nickname || '').trim();
  if (!trimmedNickname) {
    return { found: false };
  }

  try {
    const { data, error } = await (supabase.from as any)('banned_words')
      .select('level, keyword, action, category, is_active')
      .eq('is_active', true)
      .in('level', checkLevels);

    if (error) {
      console.error('Error fetching banned words for nickname validation:', error);
      return { found: false };
    }

    if (!data || data.length === 0) {
      return { found: false };
    }

    const lowerNickname = trimmedNickname.toLowerCase();

    for (const entry of data) {
      const keyword = entry.keyword?.trim();
      if (!keyword) continue;

      const normalizedKeyword = keyword.toLowerCase();
      if (lowerNickname.includes(normalizedKeyword)) {
        return {
          found: true,
          level: entry.level,
          keyword,
          action: entry.action as 'block' | 'mask' | 'review',
          category: entry.category,
          errorMessage: `名稱包含禁字：${keyword}`,
        };
      }
    }

    return { found: false };
  } catch (error) {
    console.error('Exception validating nickname:', error);
    return { found: false };
  }
};

/**
 * 根據 action 類型獲取錯誤訊息
 */
export const getBannedWordErrorMessage = (result: BannedWordCheckResult): string => {
  if (!result.found) {
    return '';
  }

  switch (result.action) {
    case 'block':
      return result.errorMessage || '內容包含禁止使用的字詞，請修改後重試';
    case 'mask':
      return result.errorMessage || '內容包含敏感字詞，將被遮罩處理';
    case 'review':
      return result.errorMessage || '內容需要審核，請稍候';
    default:
      return result.errorMessage || '內容包含不當字詞';
  }
};

