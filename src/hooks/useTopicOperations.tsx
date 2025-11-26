import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useLanguage } from "@/contexts/LanguageContext";
import { useUIText } from "@/hooks/useUIText";

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
      const exposureCosts = { normal: 30, medium: 90, high: 180 };
      const durationCosts: Record<string, number> = {
        "1": 0, "2": 0, "3": 0, "4": 1, "5": 2, "6": 3, "7": 4,
        "8": 6, "9": 8, "10": 10, "11": 12, "12": 14, "13": 16,
        "14": 18, "15": 21, "16": 24, "17": 27, "18": 30
      };
      
      const exposureCost = exposureCosts[data.exposure_level as keyof typeof exposureCosts] || 30;
      const durationCost = durationCosts[data.duration_days.toString()] || 0;
      const totalCost = exposureCost + durationCost;

      console.log('Calculated cost:', { exposureCost, durationCost, totalCost });

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

      // 5. 記錄交易（必須成功）
      const createTopicDescription = getText('tokenHistory.description.createTopic', '建立主題：{{title}}').replace('{{title}}', data.title);
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
          console.error('❌ Token transaction logging failed:');
          console.error('  Error details:', stringifyError(txError));
          console.error('  Error message:', txError?.message);
          console.error('  Error code:', txError?.code);
          console.error('  Error details:', txError?.details);
          console.error('  Error hint:', txError?.hint);
          console.error('  User ID:', user.id);
          console.error('  Amount:', -totalCost);
          console.error('  Type:', 'create_topic');
          console.error('  Topic ID:', topic.id);
          // 不影響主流程，但記錄錯誤
        } else {
          console.log('✅ Token transaction logged successfully:', {
            transactionId: txId,
            amount: -totalCost,
            type: 'create_topic',
            topicId: topic.id
          });
        }
      } catch (txErr: any) {
        console.error('❌ Token transaction logging exception:');
        console.error('  Exception details:', stringifyError(txErr));
        console.error('  Exception message:', txErr?.message);
        console.error('  Exception stack:', txErr?.stack);
        console.error('  User ID:', user.id);
        console.error('  Amount:', -totalCost);
        console.error('  Type:', 'create_topic');
        console.error('  Topic ID:', topic.id);
        // 不影響主流程，但記錄錯誤
      }

      return { success: true, topic, cost: totalCost }
    } catch (error: any) {
      console.error('Create topic error:', error);
      console.error('Error details:', {
        message: error.message,
        context: error.context,
        details: error.details,
        hint: error.hint,
        code: error.code
      });
      
      // 顯示更詳細的錯誤訊息
      if (error.message?.includes('Insufficient tokens')) {
        toast.error('代幣不足！');
      } else if (error.message?.includes('Failed to use free create qualification')) {
        toast.error('免費發起資格使用失敗');
      } else if (error.message?.includes('Forbidden')) {
        toast.error('無權限：請確認是否已登入', {
          description: '請嘗試重新整理頁面並登入'
        });
      } else if (error.message?.includes('origin')) {
        toast.error('CORS 錯誤：請聯繫開發者', {
          description: error.message
        });
      } else if (error.context?.body) {
        // 從 Edge Function 返回的錯誤
        const bodyError = typeof error.context.body === 'string' 
          ? error.context.body 
          : JSON.stringify(error.context.body);
        toast.error('建立主題失敗', {
          description: bodyError
        });
      } else if (error.message) {
        toast.error('建立主題失敗', {
          description: error.message
        });
      } else {
        toast.error('建立主題失敗', {
          description: '請查看控制台 (F12) 以獲取更多資訊'
        });
      }
      
      throw error;
    }
  };

  const checkFreeCreateQualification = async (): Promise<boolean> => {
    try {
      // 暫時跳過免費資格檢查（資料庫函數尚未部署）
      // TODO: 等 has_free_create_qualification 函數部署後再啟用
      console.log('Free create qualification check temporarily disabled');
      return false;
      
      /* 原始代碼 - 等函數部署後恢復
      const { data, error } = await supabase.rpc('has_free_create_qualification', {
        check_user_id: (await supabase.auth.getUser()).data.user?.id
      });

      if (error) {
        console.error('Error checking free create qualification:', error);
        return false;
      }

      return data || false;
      */
    } catch (error) {
      console.error('Error checking free create qualification:', error);
      return false;
    }
  };

  return { createTopic, checkFreeCreateQualification };
};
