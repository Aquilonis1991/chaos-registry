-- 添加儲值、觀看廣告、點擊卡片廣告的交易類型
-- 擴展 token_transactions 表的 transaction_type 約束

ALTER TABLE public.token_transactions
  DROP CONSTRAINT IF EXISTS token_transactions_transaction_type_check;

ALTER TABLE public.token_transactions
  ADD CONSTRAINT token_transactions_transaction_type_check
  CHECK (transaction_type IN (
    'create_topic',
    'free_create_topic',
    'cast_vote',
    'cast_free_vote',
    'free_vote',
    'watch_ad',              -- 觀看廣告（已有）
    'click_native_ad',       -- 點擊卡片廣告（新增）
    'deposit',               -- 儲值（新增）
    'complete_mission',
    'admin_adjustment',
    'purchase',
    'refund'
  ));

-- 刷新 Schema Cache
NOTIFY pgrst, 'reload schema';

