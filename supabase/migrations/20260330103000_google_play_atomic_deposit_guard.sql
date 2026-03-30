-- Google Play 補單/入帳防重複：資料庫層唯一約束 + 原子處理函式

-- 0) 先清理歷史重複 purchaseToken（保留最新一筆，其他筆移除 purchaseToken 避免唯一索引衝突）
--    注意：此步驟不會改動 amount（不會自動扣回代幣），只做去重標記以建立唯一索引。
WITH dup AS (
  SELECT
    id,
    metadata->>'purchaseToken' AS purchase_token,
    row_number() OVER (
      PARTITION BY metadata->>'purchaseToken'
      ORDER BY created_at DESC, id DESC
    ) AS rn
  FROM public.token_transactions
  WHERE transaction_type = 'deposit'
    AND metadata->>'purchaseToken' IS NOT NULL
    AND btrim(metadata->>'purchaseToken') <> ''
)
UPDATE public.token_transactions tt
SET metadata =
  (coalesce(tt.metadata, '{}'::jsonb) - 'purchaseToken')
  || jsonb_build_object(
    'duplicatePurchaseToken',
    dup.purchase_token,
    'duplicateTokenMarkedAt',
    now()
  )
FROM dup
WHERE tt.id = dup.id
  AND dup.rn > 1;

-- 1) 強化去重：同一 purchaseToken 僅允許一筆 deposit 交易
CREATE UNIQUE INDEX IF NOT EXISTS uq_token_transactions_deposit_purchase_token
  ON public.token_transactions ((metadata->>'purchaseToken'))
  WHERE transaction_type = 'deposit'
    AND metadata->>'purchaseToken' IS NOT NULL
    AND btrim(metadata->>'purchaseToken') <> '';

-- 2) 原子入帳函式：以 purchaseToken 為鍵，避免併發重複發幣
CREATE OR REPLACE FUNCTION public.process_google_play_purchase_deposit(
  p_user_id uuid,
  p_purchase_token text,
  p_product_id text,
  p_transaction_id text,
  p_package_name text,
  p_verification_method text,
  p_purchase_state int,
  p_consumption_state int,
  p_purchase_time_millis text,
  p_total_tokens int
)
RETURNS TABLE (
  applied boolean,
  tx_id uuid,
  amount int
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tx_id uuid;
  v_amount int;
BEGIN
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'p_user_id is required';
  END IF;
  IF p_purchase_token IS NULL OR btrim(p_purchase_token) = '' THEN
    RAISE EXCEPTION 'p_purchase_token is required';
  END IF;
  IF p_total_tokens IS NULL OR p_total_tokens <= 0 THEN
    RAISE EXCEPTION 'p_total_tokens must be > 0';
  END IF;

  -- 同一 token 併發請求序列化（交易級鎖，交易結束自動釋放）
  PERFORM pg_advisory_xact_lock(hashtext('gp:' || p_purchase_token));

  -- 已處理過：直接回傳既有結果
  SELECT id, amount
  INTO v_tx_id, v_amount
  FROM public.token_transactions
  WHERE transaction_type = 'deposit'
    AND metadata->>'purchaseToken' = p_purchase_token
  ORDER BY created_at DESC
  LIMIT 1;

  IF FOUND THEN
    RETURN QUERY SELECT false, v_tx_id, v_amount;
    RETURN;
  END IF;

  -- 尚未處理：先加幣，再記流水；同交易內原子完成
  PERFORM public.add_tokens(p_user_id, p_total_tokens);

  INSERT INTO public.token_transactions (
    user_id,
    amount,
    transaction_type,
    description,
    metadata
  )
  VALUES (
    p_user_id,
    p_total_tokens,
    'deposit',
    'Google Play 購買 - ' || COALESCE(p_product_id, 'unknown'),
    jsonb_build_object(
      'purchaseToken', p_purchase_token,
      'productId', p_product_id,
      'transactionId', NULLIF(p_transaction_id, ''),
      'packageName', p_package_name,
      'verificationMethod', p_verification_method,
      'purchaseState', p_purchase_state,
      'consumptionState', p_consumption_state,
      'purchaseTimeMillis', p_purchase_time_millis
    )
  )
  RETURNING id, amount INTO v_tx_id, v_amount;

  RETURN QUERY SELECT true, v_tx_id, v_amount;
END;
$$;

REVOKE ALL ON FUNCTION public.process_google_play_purchase_deposit(
  uuid, text, text, text, text, text, int, int, text, int
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.process_google_play_purchase_deposit(
  uuid, text, text, text, text, text, int, int, text, int
) TO service_role;

