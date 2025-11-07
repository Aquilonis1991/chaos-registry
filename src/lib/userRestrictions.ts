/**
 * 用戶功能限制檢查工具
 */

import { supabase } from "@/integrations/supabase/client";

export type RestrictionType = 
  | 'create_topic' 
  | 'vote' 
  | 'complete_mission' 
  | 'modify_name' 
  | 'recharge';

const restrictionLabels: Record<RestrictionType, string> = {
  create_topic: '發起主題',
  vote: '投票',
  complete_mission: '完成任務',
  modify_name: '修改名稱',
  recharge: '儲值'
};

/**
 * 檢查用戶是否被限制某項功能
 */
export const checkUserRestriction = async (
  userId: string,
  restrictionType: RestrictionType
): Promise<{ restricted: boolean; reason?: string }> => {
  try {
    console.log(`[checkUserRestriction] Checking restriction for user ${userId}, type: ${restrictionType}`);
    
    const { data, error } = await supabase.rpc('check_user_restriction', {
      p_user_id: userId,
      p_restriction_type: restrictionType
    });

    console.log(`[checkUserRestriction] RPC response:`, { data, error, dataType: typeof data, isArray: Array.isArray(data) });

    if (error) {
      console.error('[checkUserRestriction] Error checking restriction:', error);
      return { restricted: false }; // 發生錯誤時不阻擋
    }

    // RPC 函數返回 BOOLEAN，Supabase 可能直接返回 boolean 值
    // 處理各種可能的返回值格式
    let isRestricted = false;
    
    if (typeof data === 'boolean') {
      isRestricted = data;
    } else if (Array.isArray(data)) {
      // 如果是數組，取第一個元素
      isRestricted = data.length > 0 && data[0] === true;
    } else if (data && typeof data === 'object') {
      // 如果是對象，檢查 restricted 屬性
      isRestricted = (data as any).restricted === true;
    }
    
    console.log(`[checkUserRestriction] isRestricted: ${isRestricted}`);
    
    if (isRestricted) {
      // 如果需要獲取限制原因，查詢 user_restrictions 表
      try {
        const { data: restrictionData, error: restrictionError } = await supabase
          .from('user_restrictions')
          .select('reason')
          .eq('user_id', userId)
          .eq('restriction_type', restrictionType)
          .eq('is_active', true)
          .maybeSingle();

        console.log(`[checkUserRestriction] Restriction data:`, restrictionData);

        const reason = restrictionData?.reason || `${restrictionLabels[restrictionType]}功能已被暫停`;
        
        console.log(`[checkUserRestriction] Returning restricted=true, reason: ${reason}`);
        
        return {
          restricted: true,
          reason
        };
      } catch (e) {
        console.error('[checkUserRestriction] Error fetching restriction reason:', e);
        // 如果查詢失敗，使用默認消息
        return {
          restricted: true,
          reason: `${restrictionLabels[restrictionType]}功能已被暫停`
        };
      }
    }

    console.log(`[checkUserRestriction] Returning restricted=false`);
    return { restricted: false };
  } catch (error) {
    console.error('[checkUserRestriction] Exception checking restriction:', error);
    return { restricted: false };
  }
};

/**
 * 獲取限制訊息
 */
export const getRestrictionMessage = (restrictionType: RestrictionType): string => {
  return `${restrictionLabels[restrictionType]}功能已被暫停，請聯繫管理員`;
};

