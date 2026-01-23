-- Create atomic function for ad watching
-- This handles limit checking, token awarding, and counting in a single transaction

BEGIN;

CREATE OR REPLACE FUNCTION public.watch_ad_atomic(
  p_reward_amount INTEGER,
  p_max_ads_per_day INTEGER
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_profile RECORD;
  v_today_date DATE;
  v_last_watch_date DATE;
  v_current_count INTEGER;
  v_new_tokens INTEGER;
  v_transaction_id UUID;
BEGIN
  v_user_id := auth.uid();
  
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'User not authenticated';
  END IF;

  v_today_date := CURRENT_DATE; -- UTC Date by default in Postgres

  -- 1. Lock Profile for Update
  SELECT * INTO v_profile
  FROM public.profiles
  WHERE id = v_user_id
  FOR UPDATE;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'User profile not found';
  END IF;

  -- 2. Check and Reset Daily Count
  v_last_watch_date := DATE(v_profile.last_ad_watch_date);
  
  IF v_last_watch_date IS NULL OR v_last_watch_date < v_today_date THEN
    v_current_count := 0;
  ELSE
    v_current_count := COALESCE(v_profile.ad_watch_count, 0);
  END IF;

  -- 3. Check Limit
  IF v_current_count >= p_max_ads_per_day THEN
    RAISE EXCEPTION 'Daily ad watch limit reached';
  END IF;

  -- 4. Update Profile (Tokens + Count + Date)
  UPDATE public.profiles
  SET 
    tokens = COALESCE(tokens, 0) + p_reward_amount,
    ad_watch_count = v_current_count + 1,
    last_ad_watch_date = NOW(),
    last_login = NOW()
  WHERE id = v_user_id
  RETURNING tokens INTO v_new_tokens;

  -- 5. Log Transaction
  INSERT INTO public.token_transactions (
    user_id,
    amount,
    transaction_type,
    reference_id,
    description
  ) VALUES (
    v_user_id,
    p_reward_amount,
    'watch_ad',
    NULL,
    '觀看廣告獎勵'
  )
  RETURNING id INTO v_transaction_id;

  -- 6. Return Result
  RETURN jsonb_build_object(
    'success', true,
    'new_token_balance', v_new_tokens,
    'remaining_ads', p_max_ads_per_day - (v_current_count + 1)
  );

END;
$$;

GRANT EXECUTE ON FUNCTION public.watch_ad_atomic TO authenticated;

NOTIFY pgrst, 'reload schema';

COMMIT;
