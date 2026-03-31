-- iOS IAP atomic deposit (Phase 1)
-- One-time migration (idempotent where possible)

-- 1) Ensure transactionId-level de-duplication for iOS deposit transactions
CREATE UNIQUE INDEX IF NOT EXISTS uq_token_tx_ios_deposit_transaction_id
ON public.token_transactions ((metadata->>'transactionId'))
WHERE transaction_type = 'deposit'
  AND metadata ? 'transactionId'
  AND COALESCE(metadata->>'platform', '') = 'ios';

-- 2) Atomic deposit function for App Store purchases
CREATE OR REPLACE FUNCTION public.process_app_store_purchase_deposit(
  p_user_id uuid,
  p_transaction_id text,
  p_product_id text,
  p_amount integer,
  p_original_transaction_id text DEFAULT NULL,
  p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS TABLE(applied boolean, tx_id uuid, amount integer, already_processed boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_existing_id uuid;
  v_tx_id uuid;
  v_meta jsonb;
  v_lock_key bigint;
BEGIN
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'p_user_id is required';
  END IF;
  IF p_transaction_id IS NULL OR btrim(p_transaction_id) = '' THEN
    RAISE EXCEPTION 'p_transaction_id is required';
  END IF;
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'p_amount must be > 0';
  END IF;

  -- lock by transactionId to avoid race conditions
  v_lock_key := hashtextextended(p_transaction_id, 0);
  PERFORM pg_advisory_xact_lock(v_lock_key);

  -- check existing transaction
  SELECT id INTO v_existing_id
  FROM public.token_transactions
  WHERE transaction_type = 'deposit'
    AND metadata->>'transactionId' = p_transaction_id
    AND COALESCE(metadata->>'platform', '') = 'ios'
  LIMIT 1;

  IF v_existing_id IS NOT NULL THEN
    RETURN QUERY SELECT false, v_existing_id, p_amount, true;
    RETURN;
  END IF;

  -- apply tokens
  PERFORM public.add_tokens(p_user_id, p_amount);

  v_meta := COALESCE(p_metadata, '{}'::jsonb)
    || jsonb_build_object(
      'platform', 'ios',
      'transactionId', p_transaction_id,
      'originalTransactionId', p_original_transaction_id,
      'productId', p_product_id
    );

  INSERT INTO public.token_transactions (user_id, amount, transaction_type, description, metadata)
  VALUES (p_user_id, p_amount, 'deposit', 'App Store 購買 - ' || COALESCE(p_product_id, 'unknown'), v_meta)
  RETURNING id INTO v_tx_id;

  RETURN QUERY SELECT true, v_tx_id, p_amount, false;
END;
$$;

GRANT EXECUTE ON FUNCTION public.process_app_store_purchase_deposit(uuid, text, text, integer, text, jsonb) TO service_role;

NOTIFY pgrst, 'reload schema';

