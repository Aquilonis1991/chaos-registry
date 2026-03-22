-- 添加儲值、觀看廣告、點擊卡片廣告的交易類型
-- 擴展 token_transactions 表的 transaction_type 約束
-- （原檔名 20251127_* 與 Supabase 版本號衝突，改為 20251127093000）

ALTER TABLE public.token_transactions
  DROP CONSTRAINT IF EXISTS token_transactions_transaction_type_check;

-- 與前後遷移一致：含 ai_usage / admin_grant，其餘無法辨識者歸入 admin_adjustment
UPDATE public.token_transactions
SET transaction_type = 'admin_adjustment'
WHERE transaction_type IS NULL
   OR btrim(transaction_type) = ''
   OR transaction_type NOT IN (
    'create_topic',
    'free_create_topic',
    'cast_vote',
    'cast_free_vote',
    'free_vote',
    'watch_ad',
    'click_native_ad',
    'deposit',
    'complete_mission',
    'admin_adjustment',
    'purchase',
    'refund',
    'ai_usage',
    'admin_grant'
  );

ALTER TABLE public.token_transactions
  ADD CONSTRAINT token_transactions_transaction_type_check
  CHECK (transaction_type IN (
    'create_topic',
    'free_create_topic',
    'cast_vote',
    'cast_free_vote',
    'free_vote',
    'watch_ad',
    'click_native_ad',
    'deposit',
    'complete_mission',
    'admin_adjustment',
    'purchase',
    'refund',
    'ai_usage',
    'admin_grant'
  ));

-- 刷新 Schema Cache
NOTIFY pgrst, 'reload schema';
