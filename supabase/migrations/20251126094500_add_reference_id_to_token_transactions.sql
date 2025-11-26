-- Ensure token_transactions can link transactions back to related entities.
ALTER TABLE public.token_transactions
  ADD COLUMN IF NOT EXISTS reference_id UUID;

CREATE INDEX IF NOT EXISTS idx_token_transactions_reference_id
  ON public.token_transactions(reference_id);

