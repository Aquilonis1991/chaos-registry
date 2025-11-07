import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

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

const transactionTypeLabels: Record<string, string> = {
  create_topic: '建立主題',
  free_create_topic: '免費建立主題',
  cast_vote: '投票',
  cast_free_vote: '免費投票',
  free_vote: '免費投票',
  complete_mission: '完成任務',
  watch_ad: '觀看廣告',
  admin_adjustment: '系統調整',
  purchase: '購買',
};

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

export const useTokenHistory = (userId: string | undefined) => {
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

      const { data, error: fetchError } = await supabase
        .from('token_transactions')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(100);

      if (fetchError) throw fetchError;

      const processedHistory: TokenHistory[] = (data || []).map(transaction => ({
        ...transaction,
        type_label: transactionTypeLabels[transaction.transaction_type] || transaction.transaction_type,
        type_icon: transactionTypeIcons[transaction.transaction_type] || '📊',
      }));

      setHistory(processedHistory);
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

