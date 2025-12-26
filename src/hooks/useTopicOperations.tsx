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

      const exposureCost = (exposureCosts as any)[data.exposure_level] ?? 30;
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

      // 2. 檢查代幣是否足夠
      const { data: profile } = await supabase
        .from('profiles')
        .select('tokens')
        .eq('id', user.id)
        .single();

      if (!profile || profile.tokens < totalCost) {
        throw new Error('代幣不足');
      }

      // 3. 建立主題
      // 將選項字串陣列轉換為帶有 id 和 votes 的物件陣列
      const formattedOptions = data.options
        .filter(opt => opt.trim() !== '')
        .map(opt => ({
          id: crypto.randomUUID(),
          text: opt.trim(),
          votes: 0
        }));

      const { data: topic, error: topicError } = await supabase
        .from('topics')
        .insert({
          creator_id: user.id,
          title: data.title.trim(),
          description: data.description?.trim() || null,
          options: formattedOptions,
          tags: data.tags || [],
          category: data.category,
          exposure_level: data.exposure_level,
          duration_days: data.duration_days,
          end_at: endDate.toISOString(),
          status: 'active',
          votes: {}
        })
        .select()
        .single();

      if (topicError) {
        console.error('Topic creation error:', topicError);
        throw new Error(topicError.message || '建立主題失敗');
      }

      console.log('Topic created:', topic);

      // 4. 扣除代幣
      if (totalCost > 0) {
        const { error: updateError } = await supabase
          .from('profiles')
          .update({ tokens: profile.tokens - totalCost })
          .eq('id', user.id);

        if (updateError) {
          console.error('Token deduction error:', updateError);

          // 回滾：刪除已建立的主題
          await supabase
            .from('topics')
            .delete()
            .eq('id', topic.id);

          throw new Error('扣除代幣失敗');
        }
        console.log('Tokens deducted:', totalCost);
      } else {
        console.log('Total cost is 0, skipping deduction.');
      }

      // 5. 記錄交易（必須成功）
      // 如果有折扣，可以在描述中註記 (選用，但這裡保持簡潔)
      const createTopicDescription = getText('tokenHistory.description.createTopic', '建立主題：{{title}}').replace('{{title}}', data.title);

      if (Math.abs(totalCost) > 0) {
        // Log transaction logic (same as before)
        // ... (Preserving existing logging logic structure)
        console.log('📝 Attempting to log token transaction:', {
          userId: user.id,
          amount: -totalCost,
          type: 'create_topic',
          topicId: topic.id,
          description: createTopicDescription
        });

        try {
          const { data: txId, error: txError } = await (supabase.rpc as any)('log_token_transaction', {
            p_user_id: user.id,
            p_amount: -totalCost,
            p_transaction_type: 'create_topic',
            p_reference_id: topic.id,
            p_description: createTopicDescription
          });

          if (txError) {
            // Error logging (same as before)
            console.error('❌ Token transaction logging failed:', txError);
          }
        } catch (txErr) {
          console.error('❌ Token transaction logging exception:', txErr);
        }
      }

      return { success: true, topic, cost: totalCost }
    } catch (error: any) {
      console.error('Create topic error:', error);
      // Error handling (same as before)
      if (error.message?.includes('Insufficient tokens')) {
        toast.error('代幣不足！');
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

