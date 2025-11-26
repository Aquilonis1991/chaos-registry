-- Expand allowed transaction_type values for token_transactions to cover all client operations.
ALTER TABLE public.token_transactions
  DROP CONSTRAINT IF EXISTS token_transactions_transaction_type_check;

ALTER TABLE public.token_transactions
  ADD CONSTRAINT token_transactions_transaction_type_check
  CHECK (transaction_type IN (
    'create_topic','free_create_topic','cast_vote','cast_free_vote','free_vote','watch_ad','complete_mission','admin_adjustment','purchase','refund'
  ));

