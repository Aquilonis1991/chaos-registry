-- 自 20260215000000 拆分：log_token_transaction 開頭加入 rate limit

CREATE OR REPLACE FUNCTION public.log_token_transaction(
  p_user_id UUID,
  p_amount INTEGER,
  p_transaction_type TEXT,
  p_reference_id UUID DEFAULT NULL,
  p_description TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_transaction_id UUID;
  v_allowed_types TEXT[] := ARRAY[
    'create_topic',
    'free_create_topic',
    'cast_vote',
    'cast_free_vote',
    'free_vote',
    'complete_mission',
    'watch_ad',
    'admin_adjustment',
    'purchase'
  ];
BEGIN
  PERFORM public.check_general_rate_limit('api_general', 120);

  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'User must be authenticated';
  END IF;
  IF auth.uid() != p_user_id THEN
    RAISE EXCEPTION 'User can only log transactions for themselves';
  END IF;
  IF NOT (p_transaction_type = ANY(v_allowed_types)) THEN
    RAISE EXCEPTION 'Invalid transaction type: %', p_transaction_type;
  END IF;

  INSERT INTO public.token_transactions (
    user_id, amount, transaction_type, reference_id, description
  )
  VALUES (
    p_user_id, p_amount, p_transaction_type, p_reference_id, p_description
  )
  RETURNING id INTO v_transaction_id;
  RETURN v_transaction_id;
END;
$$;
