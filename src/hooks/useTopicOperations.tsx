import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useLanguage } from "@/contexts/LanguageContext";
import { useUIText } from "@/hooks/useUIText";

import { useSystemConfigCache } from "@/hooks/useSystemConfigCache";

const stringifyError = (error: any) => {
  if (!error) return "undefined";
  try {
    return JSON.stringify(error, Object.getOwnPropertyNames(error), 2);
  } catch {
    return String(error);
  }
};

interface CreateTopicData {
  title: string;
  description?: string;
  options: string[];
  category: string;
  tags: string[];
  exposure_level: string;
  duration_days: number;
}

export const useTopicOperations = () => {
  const { language } = useLanguage();
  const { getText } = useUIText(language);
  const { getConfig } = useSystemConfigCache();
  const normalizeExposureLevelForDb = (level: string) => (level === 'normal' ? 'low' : level);

  /* New Discount Logic */
  const checkDailyDiscountEligibility = async (): Promise<boolean> => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return false;

      const { data, error } = await (supabase.rpc as any)('check_daily_topic_eligibility', {
        p_user_id: user.id
      });

      if (error) {
        console.error('Error checking daily discount eligibility:', error);
        return false;
      }

      return data || false;
    } catch (error) {
      console.error('Error checking daily discount eligibility:', error);
      return false;
    }
  };

  const createTopic = async (data: CreateTopicData) => {
    try {
      const endDate = new Date();
      endDate.setDate(endDate.getDate() + data.duration_days);

      console.log('Creating topic with data (simplified version):', { ...data, end_at: endDate.toISOString() });

      // 簡化版本：直接插入資料庫，不使用 Edge Function
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        throw new Error('未登入');
      }

      // 檢查用戶是否被限制發起主題
      const { checkUserRestriction } = await import("@/lib/userRestrictions");
      const restriction = await checkUserRestriction(user.id, 'create_topic');
      if (restriction.restricted) {
        throw new Error(restriction.reason || '發起主題功能已被暫停');
      }

      // 1. 計算成本
      const exposureCosts = getConfig('exposure_costs', { normal: 30, medium: 90, high: 180 });
      // 確保 durationCosts 是 Record<string, number> 形式，若 getConfig 返回的是 JSON 物件，通常會是主要形式
      const defaultDurationCosts: Record<string, number> = {
        "1": 0, "2": 0, "3": 0, "4": 1, "5": 2, "6": 3, "7": 4,
        "8": 6, "9": 8, "10": 10, "11": 12, "12": 14, "13": 16,
        "14": 18, "15": 21, "16": 24, "17": 27, "18": 30
      };
      const durationCosts = getConfig('duration_costs', defaultDurationCosts);

      // 基礎成本
      const baseCost = getConfig('create_topic_base_cost', 0);

      // 每日折扣
      const dailyDiscount = getConfig('daily_topic_discount_tokens', 0);
      let appliedDiscount = 0;

      // 檢查折扣資格
      if (dailyDiscount > 0) {
        const isEligible = await checkDailyDiscountEligibility();
        if (isEligible) {
          appliedDiscount = dailyDiscount;
        }
      }

      const exposureCost =
        (exposureCosts as any)[data.exposure_level]
        ?? (data.exposure_level === 'normal' ? (exposureCosts as any).low : undefined)
        ?? 30;
      const durationCost = (durationCosts as any)[data.duration_days.toString()] ?? 0;

      // 計算總價：(曝光 + 天數 + 基礎) - 折扣，最小為 0
      let totalCost = Math.max(0, exposureCost + durationCost + Number(baseCost) - appliedDiscount);

      console.log('Calculated cost:', {
        exposureCost,
        durationCost,
        baseCost,
        dailyDiscount,
        appliedDiscount,
        totalCost
      });

      // 3. Atomically Create Topic & Deduct Tokens
      // 使用原子化 RPC 替代原本的非原子操作 (Insert Topic -> Update Profile -> Log Transaction)

      const createTopicDescription = getText('tokenHistory.description.createTopic', '建立主題：{{title}}').replace('{{title}}', data.title);

      // 將選項字串陣列轉換為帶有 id 和 votes 的物件陣列
      const formattedOptions = data.options
        .filter(opt => opt.trim() !== '')
        .map(opt => ({
          id: crypto.randomUUID(),
          text: opt.trim(),
          votes: 0
        }));

      const normalizedExposureLevel = normalizeExposureLevelForDb(data.exposure_level);

      const { data: rpcResult, error: rpcError } = await (supabase.rpc as any)('create_topic_atomic', {
        p_title: data.title.trim(),
        p_description: data.description?.trim() || null,
        p_options: formattedOptions,
        p_category: data.category,
        p_tags: data.tags || [],
        p_exposure_level: normalizedExposureLevel,
        p_duration_days: data.duration_days,
        p_end_at: endDate.toISOString(),
        p_total_cost: totalCost,
        p_description_token_transfer: createTopicDescription
      });

      if (rpcError) {
        console.error('Create topic atomic RPC error:', rpcError);
        // Map common errors
        if (rpcError.message?.includes('Insufficient tokens')) {
          throw new Error('失序值不足');
        }
        throw new Error(rpcError.message || '建立主題失敗');
      }

      const topicId = rpcResult?.topic_id;

      console.log('Topic created successfully via atomic RPC:', topicId);

      // 4. Return compatible result structure
      // 為了保持兼容性，我們構造一個類似的 topic 對象回傳
      // 注意：這不是完整的 topic 對象，但足夠滿足 UI 需求 (通常 UI 會重新導向或刷新)
      const mockTopic = {
        id: topicId,
        title: data.title.trim(),
        // 其他字段視需要添加，目前看來前端只要 id 或單純成功即可
      };

      return { success: true, topic: mockTopic, cost: totalCost };
    } catch (error: any) {
      console.error('Create topic error:', error);
      // Error handling (same as before)
      if (error.message?.includes('Insufficient tokens')) {
        toast.error('失序值不足！');
      } else {
        toast.error(error.message || '建立主題失敗');
      }
      throw error;
    }
  };

  const checkFreeCreateQualification = async (): Promise<boolean> => {
    // Keep existing logic for free qualification if needed, or remove if obsolete.
    // For now, keeping as disabled placeholder as seen in previous file.
    console.log('Free create qualification check temporarily disabled');
    return false;
  };

  return { createTopic, checkFreeCreateQualification, checkDailyDiscountEligibility };
};

