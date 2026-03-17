-- 補齊用戶管理/派發功能需要的欄位與交易類型
-- - 修正錯誤：column "balance_after" of relation "token_transactions" does not exist
-- - 支援 admin_grant_tokens() 記錄 created_by / balance_after

ALTER TABLE public.token_transactions
  ADD COLUMN IF NOT EXISTS balance_after integer,
  ADD COLUMN IF NOT EXISTS created_by uuid;

-- 擴充 transaction_type 允許 admin_grant（保留既有類型）
ALTER TABLE public.token_transactions
  DROP CONSTRAINT IF EXISTS token_transactions_transaction_type_check;

ALTER TABLE public.token_transactions
  ADD CONSTRAINT token_transactions_transaction_type_check
  CHECK (transaction_type IN (
    'ai_usage',
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
    'admin_grant',
    'purchase',
    'refund'
  ));

-- 刷新 Schema Cache（PostgREST）
NOTIFY pgrst, 'reload schema';

