-- Final fix for all voting functions (Free & Token)
-- Ensures "option-N" legacy ID support is robust across all functions.

BEGIN;

-- 1. Helper Function: increment_option_votes
-- Used by cast_vote_atomic
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
  v_new_votes INTEGER;
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


-- 2. Free Vote Function: increment_free_vote
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


-- 3. Atomic Token Vote: cast_vote_atomic
-- (Logic unchanged, just ensuring it exists and has permissions)
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

  -- Increment Votes (This will now fail if option invalid, due to step 1 fix)
  PERFORM public.increment_option_votes(p_topic_id, p_option_id, p_vote_amount);

  -- Record Vote
  INSERT INTO public.votes (topic_id, user_id, option, amount)
  VALUES (p_topic_id, v_user_id, p_option_id, p_vote_amount)
  ON CONFLICT (user_id, topic_id) 
  DO UPDATE SET amount = votes.amount + EXCLUDED.amount, option = EXCLUDED.option, updated_at = now();

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

COMMIT;
