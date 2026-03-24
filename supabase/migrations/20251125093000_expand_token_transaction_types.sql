-- Expand allowed transaction_type values for token_transactions to cover all client operations.
ALTER TABLE public.token_transactions
  DROP CONSTRAINT IF EXISTS token_transactions_transaction_type_check;

-- 既有列可能含較晚遷移／App 寫入的類型；無法對應者改為 admin_adjustment，避免 CHECK 失敗
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
    'complete_mission',
    'admin_adjustment',
    'purchase',
    'refund',
    'click_native_ad',
    'deposit',
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
    'complete_mission',
    'admin_adjustment',
    'purchase',
    'refund',
    'click_native_ad',
    'deposit',
    'ai_usage',
    'admin_grant'
  ));
