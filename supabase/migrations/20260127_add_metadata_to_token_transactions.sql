-- Add metadata column to token_transactions for storing purchase information
-- This allows us to store purchaseToken, productId, and other purchase details

ALTER TABLE public.token_transactions
  ADD COLUMN IF NOT EXISTS metadata JSONB;

-- Create GIN index on the entire metadata JSONB column for fast JSONB queries
-- This allows efficient queries on any JSONB path within metadata
CREATE INDEX IF NOT EXISTS idx_token_transactions_metadata_gin
  ON public.token_transactions USING GIN (metadata);

-- Create btree index on metadata->>purchaseToken for fast duplicate purchase detection
-- btree is more efficient for exact text matches than GIN on extracted text
CREATE INDEX IF NOT EXISTS idx_token_transactions_metadata_purchase_token
  ON public.token_transactions (CAST(metadata->>'purchaseToken' AS TEXT))
  WHERE metadata->>'purchaseToken' IS NOT NULL;

-- Create btree index on metadata->>productId for product-based queries
CREATE INDEX IF NOT EXISTS idx_token_transactions_metadata_product_id
  ON public.token_transactions (CAST(metadata->>'productId' AS TEXT))
  WHERE metadata->>'productId' IS NOT NULL;

-- Add comment
COMMENT ON COLUMN public.token_transactions.metadata IS 'Additional transaction metadata (e.g., purchaseToken, productId, transactionId for in-app purchases)';
