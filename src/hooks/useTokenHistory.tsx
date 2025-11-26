import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useUIText } from "@/hooks/useUIText";
import { useLanguage } from "@/contexts/LanguageContext";

export interface TokenHistory {
  id: string;
  amount: number;
  transaction_type: string;
  description?: string;
  reference_id?: string;
  created_at: string;
  // Computed fields
  type_label?: string;
  type_icon?: string;
}

const transactionTypeIcons: Record<string, string> = {
  create_topic: '📝',
  free_create_topic: '📝',
  cast_vote: '🗳️',
  cast_free_vote: '🎁',
  free_vote: '🎁',
  complete_mission: '✅',
  watch_ad: '📺',
  admin_adjustment: '⚙️',
  purchase: '💰',
};

const normalizeTransactionType = (type: string): string => {
  if (type === 'free_create_topic') return 'create_topic';
  if (type === 'cast_free_vote') return 'free_vote';
  return type;
};

const parseAmountValue = (amount: number | string | null | undefined): number => {
  if (typeof amount === 'number') return amount;
  if (typeof amount === 'string') {
    const parsed = parseFloat(amount);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
};

const calculateTopicCost = (
  exposureLevel?: string | null,
  durationDays?: number | null
): number => {
  const exposureCosts: Record<string, number> = { normal: 30, medium: 90, high: 180 };
  const durationCosts: Record<string, number> = {
    "1": 0, "2": 0, "3": 0, "4": 1, "5": 2, "6": 3, "7": 4,
    "8": 6, "9": 8, "10": 10, "11": 12, "12": 14, "13": 16,
    "14": 18, "15": 21, "16": 24, "17": 27, "18": 30
  };

  const exposureCost = exposureLevel ? (exposureCosts[exposureLevel] ?? 30) : 30;
  const durationKey = durationDays != null ? durationDays.toString() : "0";
  const durationCost = durationCosts[durationKey] ?? 0;

  return exposureCost + durationCost;
};

const getTransactionTypeLabel = (type: string, getText: (key: string, fallback: string) => string): string => {
  const labels: Record<string, string> = {
    create_topic: getText('tokenHistory.type.createTopic', '建立主題'),
    free_create_topic: getText('tokenHistory.type.freeCreateTopic', '免費建立主題'),
    cast_vote: getText('tokenHistory.type.castVote', '投票'),
    cast_free_vote: getText('tokenHistory.type.freeVote', '免費投票'),
    free_vote: getText('tokenHistory.type.freeVote', '免費投票'),
    complete_mission: getText('tokenHistory.type.completeMission', '完成任務'),
    watch_ad: getText('tokenHistory.type.watchAd', '觀看廣告'),
    admin_adjustment: getText('tokenHistory.type.adminAdjustment', '系統調整'),
    purchase: getText('tokenHistory.type.purchase', '購買'),
  };
  return labels[type] || type;
};

const formatTransactionDescription = (
  description: string | null | undefined,
  transactionType: string,
  getText: (key: string, fallback: string) => string
): string | undefined => {
  if (!description) return undefined;

  const normalize = description.trim();

  if (/每日登入獎勵|Daily Login Reward/i.test(normalize)) {
    return getText('tokenHistory.description.dailyLoginReward', '每日登入獎勵');
  }

  const createTopicMatch = normalize.match(/^(?:建立主題[：:]|Created topic:?\s*)(.+)$/i);
  if (createTopicMatch) {
    const title = createTopicMatch[1].trim();
    return getText('tokenHistory.description.createTopic', '建立主題：{{title}}').replace('{{title}}', title);
  }

  const freeCreateTopicMatch = normalize.match(/^(?:免費建立主題[：:]|Created topic for free:?\s*)(.+)$/i);
  if (freeCreateTopicMatch) {
    const title = freeCreateTopicMatch[1].trim();
    return getText('tokenHistory.description.freeCreateTopic', '免費建立主題：{{title}}').replace('{{title}}', title);
  }

  const voteAmountMatch = normalize.match(/(?:投票使用|Voted on topic with)\s+(\d+)\s+(?:代幣|tokens?)/i);
  if (voteAmountMatch) {
    const amount = voteAmountMatch[1];
    return getText('tokenHistory.description.castVote', '投票使用 {{amount}} 代幣')
      .replace('{{amount}}', amount);
  }

  const voteDetailMatch = normalize.match(/^(?:投票：|Vote:?)(.+?)(?:[-|–]\s*(?:選項|Option)：?\s*(.+))?$/i);
  if (voteDetailMatch) {
    const title = voteDetailMatch[1].trim();
    const option = voteDetailMatch[2]?.trim();
    if (option) {
      return getText('tokenHistory.description.voteWithOption', '投票：{{title}}（選項：{{option}}）')
        .replace('{{title}}', title)
        .replace('{{option}}', option);
    }
    return getText('tokenHistory.description.vote', '投票：{{title}}').replace('{{title}}', title);
  }

  const watchAdMatch = normalize.match(/(?:觀看廣告|Watch Ad).*?(\d+)\s*(?:代幣|tokens?)/i);
  if (watchAdMatch) {
    const amount = watchAdMatch[1];
    return getText('tokenHistory.description.watchAdReward', '觀看廣告獲得 {{amount}} 代幣')
      .replace('{{amount}}', amount);
  }

  if (/觀看廣告|Watch Ad/i.test(normalize)) {
    return getText('tokenHistory.mission.watchAd', '觀看廣告');
  }

  if (/每日登入|Daily Login/i.test(normalize)) {
    return getText('tokenHistory.mission.dailyLogin', '每日登入');
  }

  if (/完成任務|Complete Mission/i.test(normalize)) {
    return getText('tokenHistory.mission.completeMission', '完成任務');
  }

  if (transactionType === 'complete_mission') {
    return getText('tokenHistory.description.completeMission', '完成任務');
  }

  return description;
};

export const useTokenHistory = (userId: string | undefined) => {
  const { language } = useLanguage();
  const { getText } = useUIText(language);
  const [history, setHistory] = useState<TokenHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) {
      setHistory([]);
      setLoading(false);
      return;
    }

    fetchTokenHistory();
  }, [userId]);

  const fetchTokenHistory = async () => {
    if (!userId) return;

    try {
      setLoading(true);
      setError(null);

      const { data: transactions, error: transactionsError } = await supabase
        .from('token_transactions')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(200);

      if (transactionsError) {
        console.error('❌ Error fetching token_transactions:', transactionsError);
        throw transactionsError;
      }

      console.log('📊 Raw transactions from database:', {
        count: transactions?.length || 0,
        transactions: transactions?.map(t => ({
          id: t.id,
          type: t.transaction_type,
          amount: t.amount,
          amountType: typeof t.amount,
          description: t.description,
          created_at: t.created_at
        }))
      });

      const topicReferenceIds = Array.from(
        new Set(
          (transactions || [])
            .filter((t) =>
              (t.transaction_type === 'create_topic' || t.transaction_type === 'free_create_topic') &&
              typeof t.reference_id === 'string'
            )
            .map((t) => t.reference_id as string)
        )
      );

      const topicCostMap = new Map<string, number>();

      if (topicReferenceIds.length > 0) {
        const { data: topicDetails, error: topicError } = await supabase
          .from('topics')
          .select('id, exposure_level, duration_days')
          .in('id', topicReferenceIds);

        if (topicError) {
          console.warn('Error fetching topic costs:', topicError);
        } else if (topicDetails) {
          topicDetails.forEach(topic => {
            const cost = calculateTopicCost(topic.exposure_level, topic.duration_days);
            topicCostMap.set(topic.id, cost);
          });
        }
      }

      const processedTransactions: TokenHistory[] = (transactions || []).map(transaction => {
        // 先解析 amount，確保正確處理
        let amountValue = parseAmountValue(transaction.amount);
        const originalType = transaction.transaction_type;
        
        // 調試日誌：記錄原始資料
        console.log('🔍 Processing transaction:', {
          id: transaction.id,
          type: originalType,
          amount: transaction.amount,
          amountType: typeof transaction.amount,
          parsedAmount: amountValue,
          reference_id: transaction.reference_id
        });
        
        // 決定最終的 transaction_type
        let normalizedType: string;
        
        // 如果原本是 free_create_topic 但 amount 是負數（有實際支出），應該改為 create_topic
        if (originalType === 'free_create_topic' && amountValue < 0) {
          normalizedType = 'create_topic';
        } else if (originalType === 'create_topic' && amountValue === 0) {
          // 如果原本是 create_topic 但 amount 為 0，嘗試從主題資訊重新計算成本
          normalizedType = 'create_topic';
          if (typeof transaction.reference_id === 'string') {
            const computedCost = topicCostMap.get(transaction.reference_id);
            if (computedCost && computedCost > 0) {
              amountValue = -computedCost;
            }
          }
        } else {
          // 其他情況使用 normalizeTransactionType
          normalizedType = normalizeTransactionType(originalType);
          
          // 對於建立主題的交易，如果 amount 為 0 或 null，嘗試從主題資訊重新計算成本
          if (
            normalizedType === 'create_topic' &&
            (amountValue === 0 || transaction.amount == null) &&
            typeof transaction.reference_id === 'string'
          ) {
            const computedCost = topicCostMap.get(transaction.reference_id);
            if (computedCost && computedCost > 0) {
              amountValue = -computedCost;
            }
          }
        }

        const result = {
          ...transaction,
          transaction_type: normalizedType,
          amount: amountValue,
          type_label: getTransactionTypeLabel(normalizedType, getText),
          type_icon: transactionTypeIcons[normalizedType] || '📊',
          description: formatTransactionDescription(transaction.description, normalizedType, getText),
        };

        // 調試日誌：記錄處理後的資料
        console.log('✅ Processed transaction:', {
          id: result.id,
          type: result.transaction_type,
          amount: result.amount,
          label: result.type_label
        });

        return result;
      });

      console.log('📊 Processed transactions:', {
        count: processedTransactions.length,
        transactions: processedTransactions.map(t => ({
          id: t.id,
          type: t.transaction_type,
          amount: t.amount,
          label: t.type_label,
          isExpense: t.amount < 0,
          isIncome: t.amount > 0
        })),
        expenseCount: processedTransactions.filter(t => t.amount < 0).length,
        incomeCount: processedTransactions.filter(t => t.amount > 0).length,
        zeroCount: processedTransactions.filter(t => t.amount === 0).length
      });

      setHistory(processedTransactions);
    } catch (err: any) {
      console.error('Error fetching token history:', err);
      setError(err.message || '獲取代幣歷史失敗');
      toast.error('載入代幣紀錄失敗');
    } finally {
      setLoading(false);
    }
  };

  const refreshHistory = () => {
    fetchTokenHistory();
  };

  return {
    history,
    loading,
    error,
    refreshHistory,
  };
};

