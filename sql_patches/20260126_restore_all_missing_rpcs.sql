-- RESTORE ALL MISSING RPCs (Unified Patch)
-- run this if you see "function not found" errors.

BEGIN;

-------------------------------------------------------------------------------
-- 1. Create Topic Atomic (create_topic_atomic)
-------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_topic_atomic(
  p_title TEXT,
  p_description TEXT,
  p_options JSONB,
  p_category TEXT,
  p_tags TEXT[],
  p_exposure_level TEXT,
  p_duration_days INTEGER,
  p_end_at TIMESTAMPTZ,
  p_total_cost INTEGER,
  p_description_token_transfer TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_new_tokens INTEGER;
  v_topic_id UUID;
  v_transaction_id UUID;
BEGIN
  v_user_id := auth.uid();
  
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'User not authenticated';
  END IF;

  -- 1. Check and Lock User Profile for Update
  SELECT tokens INTO v_new_tokens
  FROM public.profiles
  WHERE id = v_user_id
  FOR UPDATE;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'User profile not found';
  END IF;
  
  IF v_new_tokens < p_total_cost THEN
    RAISE EXCEPTION 'Insufficient tokens: Required %, Available %', p_total_cost, v_new_tokens;
  END IF;

  -- 2. Deduct Tokens (if cost > 0)
  IF p_total_cost > 0 THEN
    UPDATE public.profiles
    SET tokens = tokens - p_total_cost
    WHERE id = v_user_id;
  END IF;

  -- 3. Insert Topic
  INSERT INTO public.topics (
    creator_id,
    title,
    description,
    options,
    tags,
    category,
    exposure_level,
    duration_days,
    end_at,
    status,
    votes,
    created_at,
    updated_at
  ) VALUES (
    v_user_id,
    p_title,
    p_description,
    p_options,
    p_tags,
    p_category,
    p_exposure_level,
    p_duration_days,
    p_end_at,
    'active',
    '{}'::JSONB,
    NOW(),
    NOW()
  )
  RETURNING id INTO v_topic_id;

  -- 4. Log Transaction (if cost > 0)
  IF p_total_cost > 0 THEN
    INSERT INTO public.token_transactions (
      user_id,
      amount,
      transaction_type,
      reference_id,
      description,
      metadata
    ) VALUES (
      v_user_id,
      -p_total_cost, -- Negative for deduction
      'create_topic',
      v_topic_id,
      p_description_token_transfer,
      jsonb_build_object('topic_title', p_title)
    )
    RETURNING id INTO v_transaction_id;
  END IF;

  -- 5. Return Result
  RETURN jsonb_build_object(
    'success', true,
    'topic_id', v_topic_id,
    'transaction_id', v_transaction_id
  );

END;
$$;

GRANT EXECUTE ON FUNCTION public.create_topic_atomic TO authenticated;


-------------------------------------------------------------------------------
-- 2. Watch Ad Atomic (watch_ad_atomic)
-------------------------------------------------------------------------------
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


-------------------------------------------------------------------------------
-- 3. Voting Functions (Fix Voting Logic & Option IDs)
-------------------------------------------------------------------------------

-- 3.1. increment_option_votes
CREATE OR REPLACE FUNCTION public.increment_option_votes(
  p_topic_id UUID,
  p_option_id TEXT,
  p_vote_amount INTEGER
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_topic_status TEXT;
  v_end_at TIMESTAMPTZ;
  v_options JSONB;
  v_option_index INTEGER := -1;
BEGIN
  -- Check Topic
  SELECT status, end_at, options INTO v_topic_status, v_end_at, v_options
  FROM public.topics
  WHERE id = p_topic_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Topic not found';
  END IF;

  IF v_topic_status = 'ended' OR v_end_at <= now() THEN
    RAISE EXCEPTION 'Topic has ended';
  END IF;

  -- Find Option Index (Robust matching)
  FOR i IN 0..jsonb_array_length(v_options) - 1 LOOP
    IF (v_options->i->>'id') = p_option_id 
       OR ((v_options->i->>'id') IS NULL AND p_option_id = 'option-' || i::text) THEN
      v_option_index := i;
      EXIT;
    END IF;
  END LOOP;

  IF v_option_index = -1 THEN
    RAISE EXCEPTION 'Option not found: %', p_option_id;
  END IF;

  -- Update specific option using path
  UPDATE public.topics
  SET 
    options = jsonb_set(
      options,
      ARRAY[v_option_index::text, 'votes'],
      to_jsonb(COALESCE((options->v_option_index->>'votes')::INTEGER, 0) + p_vote_amount)
    ),
    total_votes = COALESCE(total_votes, 0) + p_vote_amount
  WHERE id = p_topic_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.increment_option_votes(UUID, TEXT, INTEGER) TO authenticated;


-- 3.2. increment_free_vote
CREATE OR REPLACE FUNCTION public.increment_free_vote(
  p_topic_id UUID,
  p_option_id TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_topic_record RECORD;
  v_option_index INTEGER := -1;
  v_already_used BOOLEAN;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  -- Check Daily Limit (UTC)
  SELECT EXISTS(
    SELECT 1 FROM public.free_votes
    WHERE user_id = v_user_id
      AND topic_id = p_topic_id
      AND used_at >= CURRENT_DATE -- UTC Midnight
  ) INTO v_already_used;

  IF v_already_used THEN
    RAISE EXCEPTION 'Free vote already used today';
  END IF;

  -- Get Topic
  SELECT * INTO v_topic_record FROM public.topics WHERE id = p_topic_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Topic not found'; END IF;
  IF v_topic_record.status != 'active' OR v_topic_record.end_at < NOW() THEN
    RAISE EXCEPTION 'Topic has ended';
  END IF;

  -- Find Option Index (Robust matching)
  FOR i IN 0..jsonb_array_length(v_topic_record.options) - 1 LOOP
    IF (v_topic_record.options->i->>'id') = p_option_id 
       OR ((v_topic_record.options->i->>'id') IS NULL AND p_option_id = 'option-' || i::text) THEN
      v_option_index := i;
      EXIT;
    END IF;
  END LOOP;

  IF v_option_index = -1 THEN
    RAISE EXCEPTION 'Option not found: %', p_option_id;
  END IF;

  -- Update Topic (Vote + Free Count)
  UPDATE public.topics
  SET 
    options = jsonb_set(
      options,
      ARRAY[v_option_index::text, 'votes'],
      to_jsonb(COALESCE((options->v_option_index->>'votes')::INTEGER, 0) + 1)
    ),
    free_votes_count = COALESCE(free_votes_count, 0) + 1
  WHERE id = p_topic_id;

  -- Record usage
  INSERT INTO public.free_votes (user_id, topic_id, option, used_at)
  VALUES (v_user_id, p_topic_id, p_option_id, NOW());
  
  -- Add participant
  INSERT INTO public.topic_participants (topic_id, user_id)
  VALUES (p_topic_id, v_user_id)
  ON CONFLICT DO NOTHING;
END;
$$;

GRANT EXECUTE ON FUNCTION public.increment_free_vote(UUID, TEXT) TO authenticated;


-- 3.3. cast_vote_atomic
CREATE OR REPLACE FUNCTION public.cast_vote_atomic(
  p_topic_id UUID,
  p_option_id TEXT,
  p_vote_amount INTEGER,
  p_description TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_current_tokens INTEGER;
  v_transaction_id UUID;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  -- Lock Profile
  SELECT tokens INTO v_current_tokens FROM public.profiles WHERE id = v_user_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'User profile not found'; END IF;
  IF v_current_tokens < p_vote_amount THEN
    RAISE EXCEPTION 'Insufficient tokens';
  END IF;

  -- Deduct
  UPDATE public.profiles SET tokens = tokens - p_vote_amount WHERE id = v_user_id;

  -- Increment Votes
  PERFORM public.increment_option_votes(p_topic_id, p_option_id, p_vote_amount);

  -- Record Vote
  INSERT INTO public.votes (topic_id, user_id, option, amount)
  VALUES (p_topic_id, v_user_id, p_option_id, p_vote_amount)
  ON CONFLICT (user_id, topic_id) 
  DO UPDATE SET amount = votes.amount + EXCLUDED.amount, option = EXCLUDED.option;

  -- Log Transaction
  INSERT INTO public.token_transactions (user_id, amount, transaction_type, reference_id, description, created_at)
  VALUES (v_user_id, -p_vote_amount, 'cast_vote', p_topic_id, p_description, now())
  RETURNING id INTO v_transaction_id;

  -- Add Participant
  INSERT INTO public.topic_participants (topic_id, user_id) VALUES (p_topic_id, v_user_id) ON CONFLICT DO NOTHING;

  RETURN jsonb_build_object('success', true, 'new_balance', v_current_tokens - p_vote_amount, 'transaction_id', v_transaction_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.cast_vote_atomic(UUID, TEXT, INTEGER, TEXT) TO authenticated;

-------------------------------------------------------------------------------
-- 4. Admin/System Functions (add_tokens)
-- Required for Purchase Verification
-------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.add_tokens(
  user_id uuid,
  token_amount integer
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- 驗證 1: 檢查權限
  -- 如果是 Service Role (Edge Function)，auth.uid() 通常為 NULL，應該允許通過
  IF current_user != 'service_role' AND auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Unauthorized: User must be authenticated';
  END IF;

  -- 驗證 2: 只能增加自己的代幣（或是由 Service Role 調用）
  -- 只有在非 Service Role 且有 auth.uid() 時才檢查
  IF current_user != 'service_role' AND auth.uid() IS NOT NULL AND auth.uid() != user_id THEN
      RAISE EXCEPTION 'Forbidden: Users can only add tokens to their own account';
  END IF;

  -- 驗證 3: 代幣數量必須為正數
  IF token_amount <= 0 THEN
    RAISE EXCEPTION 'Invalid token amount: Must be positive';
  END IF;

  -- 執行更新
  UPDATE public.profiles
  SET tokens = tokens + token_amount
  WHERE id = user_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'User not found';
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.add_tokens(uuid, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.add_tokens(uuid, integer) TO service_role;


NOTIFY pgrst, 'reload schema';

COMMIT;
