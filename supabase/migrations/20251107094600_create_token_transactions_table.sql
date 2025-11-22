-- Create token_transactions table if it does not exist
CREATE TABLE IF NOT EXISTS public.token_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount INTEGER NOT NULL,
  transaction_type TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.token_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own token transactions"
  ON public.token_transactions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own token transactions"
  ON public.token_transactions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_token_transactions_user_created_at
  ON public.token_transactions(user_id, created_at DESC);


