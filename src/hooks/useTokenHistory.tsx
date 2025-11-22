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
  free_create_topic: '🎁',
  cast_vote: '🗳️',
  cast_free_vote: '🎁',
  free_vote: '🎁',
  complete_mission: '✅',
  watch_ad: '📺',
  admin_adjustment: '⚙️',
  purchase: '💰',
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

  // 處理常見的完全匹配描述
  if (description === '每日登入獎勵' || description === 'Daily Login Reward') {
    return getText('tokenHistory.description.dailyLoginReward', '每日登入獎勵');
  }

  // 處理「建立主題：XXX」格式（中文和英文）
  const createTopicMatch = description.match(/^(?:建立主題：|Created topic:?\s*)(.+)$/);
  if (createTopicMatch) {
    const title = createTopicMatch[1].trim();
    return getText('tokenHistory.description.createTopic', '建立主題：{{title}}').replace('{{title}}', title);
  }

  // 處理「免費建立主題：XXX」格式（中文和英文）
  const freeCreateTopicMatch = description.match(/^(?:免費建立主題：|Created topic for free:?\s*)(.+)$/);
  if (freeCreateTopicMatch) {
    const title = freeCreateTopicMatch[1].trim();
    return getText('tokenHistory.description.freeCreateTopic', '免費建立主題：{{title}}').replace('{{title}}', title);
  }

  // 處理「投票使用 XXX 代幣」格式（中文和英文）
  const voteMatch = description.match(/(?:投票使用|Voted on topic with)\s+(\d+)\s+(?:代幣|tokens?)/i);
  if (voteMatch) {
    const amount = voteMatch[1];
    return getText('tokenHistory.description.castVote', '投票使用 {{amount}} 代幣').replace('{{amount}}', amount);
  }

  // 處理任務名稱（每日登入、觀看廣告等）
  if (description.includes('每日登入') || description.includes('Daily Login')) {
    return getText('tokenHistory.mission.dailyLogin', '每日登入');
  }
  if (description.includes('觀看廣告') || description.includes('Watch Ad')) {
    return getText('tokenHistory.mission.watchAd', '觀看廣告');
  }
  if (description.includes('完成任務') || description.includes('Complete Mission')) {
    return getText('tokenHistory.mission.completeMission', '完成任務');
  }

  // 預設返回原始描述
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

      // 獲取 token_transactions 記錄
      const { data: transactions, error: transactionsError } = await supabase
        .from('token_transactions')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(200);

      if (transactionsError) throw transactionsError;

      // 獲取用戶建立的主題（補充可能遺漏的記錄）
      const { data: createdTopics, error: topicsError } = await supabase
        .from('topics')
        .select('id, title, created_at, exposure_level, duration_days')
        .eq('creator_id', userId)
        .order('created_at', { ascending: false })
        .limit(100);

      if (topicsError) console.warn('Error fetching topics:', topicsError);

      // 獲取用戶的投票記錄（補充可能遺漏的記錄）
      const { data: votes, error: votesError } = await supabase
        .from('votes')
        .select('id, topic_id, amount, created_at')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(200);

      if (votesError) console.warn('Error fetching votes:', votesError);

      // 處理 token_transactions 記錄
      const processedTransactions: TokenHistory[] = (transactions || []).map(transaction => ({
        ...transaction,
        type_label: getTransactionTypeLabel(transaction.transaction_type, getText),
        type_icon: transactionTypeIcons[transaction.transaction_type] || '📊',
        description: formatTransactionDescription(transaction.description, transaction.transaction_type, getText),
      }));

      // 檢查並補充建立主題的支出記錄（如果沒有對應的 token_transactions）
      const topicTransactionIds = new Set(
        (transactions || [])
          .filter(t => t.transaction_type === 'create_topic' || t.transaction_type === 'free_create_topic')
          .map(t => t.reference_id)
          .filter(Boolean)
      );

      const missingTopicTransactions: TokenHistory[] = (createdTopics || [])
        .filter(topic => !topicTransactionIds.has(topic.id))
        .map(topic => ({
          id: `topic_${topic.id}`,
          amount: 0, // 無法確定歷史成本，標記為免費
          transaction_type: 'free_create_topic',
          description: getText('tokenHistory.description.createTopic', '建立主題：{{title}}').replace('{{title}}', topic.title),
          reference_id: topic.id,
          created_at: topic.created_at,
          type_label: getTransactionTypeLabel('free_create_topic', getText),
          type_icon: transactionTypeIcons['free_create_topic'] || '🎁',
        }));

      // 檢查並補充投票的支出記錄（如果沒有對應的 token_transactions）
      const voteTransactionIds = new Set(
        (transactions || [])
          .filter(t => t.transaction_type === 'cast_vote' || t.transaction_type === 'cast_free_vote')
          .map(t => t.reference_id)
          .filter(Boolean)
      );

      const missingVoteTransactions: TokenHistory[] = (votes || [])
        .filter(vote => !voteTransactionIds.has(vote.topic_id))
        .map(vote => ({
          id: `vote_${vote.id}`,
          amount: -vote.amount, // 負數表示支出
          transaction_type: 'cast_vote',
          description: getText('tokenHistory.description.castVote', '投票使用 {{amount}} 代幣').replace('{{amount}}', vote.amount.toString()),
          reference_id: vote.topic_id,
          created_at: vote.created_at,
          type_label: getTransactionTypeLabel('cast_vote', getText),
          type_icon: transactionTypeIcons['cast_vote'] || '🗳️',
        }));

      // 合併所有記錄並按時間排序
      const allHistory = [
        ...processedTransactions,
        ...missingTopicTransactions,
        ...missingVoteTransactions,
      ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        .slice(0, 200); // 限制總數

      setHistory(allHistory);
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

