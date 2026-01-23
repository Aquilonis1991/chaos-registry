-- Atomic function for casting token votes
-- Replaces the flaky frontend-orchestrated multi-step process.

CREATE OR REPLACE FUNCTION public.cast_vote_atomic(
  p_topic_id UUID,
  p_option_id TEXT,
  p_vote_amount INTEGER,
  p_description TEXT
)
RETURNS JSONB -- Returns success/new_balance
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
  
  -- 1. Check Authentication
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- 2. Check & Deduct Tokens
  -- Lock the profile row for update
  SELECT tokens INTO v_current_tokens
  FROM public.profiles
  WHERE id = v_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'User profile not found';
  END IF;

  IF v_current_tokens < p_vote_amount THEN
    RAISE EXCEPTION 'Insufficient tokens. Current: %, Required: %', v_current_tokens, p_vote_amount;
  END IF;

  -- Deduct tokens
  UPDATE public.profiles
  SET tokens = tokens - p_vote_amount
  WHERE id = v_user_id;

  -- 3. Update Topic Vote Counts (Call existing helper)
  -- This will raise exception if topic not found, ended, or option invalid
  PERFORM public.increment_option_votes(p_topic_id, p_option_id, p_vote_amount);

  -- 4. Record Vote in `votes` table
  INSERT INTO public.votes (topic_id, user_id, option, amount)
  VALUES (p_topic_id, v_user_id, p_option_id, p_vote_amount)
  ON CONFLICT (user_id, topic_id) 
  DO UPDATE SET 
    amount = votes.amount + EXCLUDED.amount,
    option = EXCLUDED.option, -- Update option to latest choice
    updated_at = now();

  -- 5. Log Token Transaction
  INSERT INTO public.token_transactions (
    user_id,
    amount,
    transaction_type,
    reference_id,
    description,
    created_at
  )
  VALUES (
    v_user_id,
    -p_vote_amount,
    'cast_vote',
    p_topic_id,
    p_description,
    now()
  )
  RETURNING id INTO v_transaction_id;

  -- 6. Add to participants (Duplicate ignore)
  INSERT INTO public.topic_participants (topic_id, user_id)
  VALUES (p_topic_id, v_user_id)
  ON CONFLICT DO NOTHING;

  -- Return result
  RETURN jsonb_build_object(
    'success', true,
    'new_balance', v_current_tokens - p_vote_amount,
    'transaction_id', v_transaction_id
  );

EXCEPTION
  WHEN OTHERS THEN
    -- If anything fails, transaction rolls back automatically
    RAISE;
END;
$$;

GRANT EXECUTE ON FUNCTION public.cast_vote_atomic TO authenticated;
