-- process_google_play_purchase_deposit 實測時噴 42702 "column reference amount is ambiguous"：
-- 函式的 RETURNS TABLE(..., amount int) 讓 amount 在函式體內變成隱含變數，跟查詢
-- token_transactions.amount 這個實際欄位撞名。原本的 SELECT id, amount / RETURNING id, amount
-- 都是裸欄位名稱，改成明確用表格別名（tt.amount）消除歧義，邏輯完全不變。
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
  SELECT tt.id, tt.amount
  INTO v_tx_id, v_amount
  FROM public.token_transactions tt
  WHERE tt.transaction_type = 'deposit'
    AND tt.metadata->>'purchaseToken' = p_purchase_token
  ORDER BY tt.created_at DESC
  LIMIT 1;

  IF FOUND THEN
    RETURN QUERY SELECT false, v_tx_id, v_amount;
    RETURN;
  END IF;

  -- 尚未處理：先加幣，再記流水；同交易內原子完成
  PERFORM public.add_tokens(p_user_id, p_total_tokens);

  INSERT INTO public.token_transactions AS tt (
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
  RETURNING tt.id, tt.amount INTO v_tx_id, v_amount;

  RETURN QUERY SELECT true, v_tx_id, v_amount;
END;
$$;

-- 這次是純 CREATE OR REPLACE（signature 不變），權限不受影響，
-- 但保險起見重新確認一次，避免任何工具重建函式時權限被重置
REVOKE EXECUTE ON FUNCTION public.process_google_play_purchase_deposit(
  uuid, text, text, text, text, text, int, int, text, int
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.process_google_play_purchase_deposit(
  uuid, text, text, text, text, text, int, int, text, int
) TO service_role;
