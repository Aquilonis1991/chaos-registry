-- FIX ALL MISSING LOGIC (The REAL Final Version)
-- Date: 2026-01-28
-- Description:
-- 1. Fixes 'add_tokens' by using correct parameter names (user_id) to match Edge Function calls.
-- 2. Fixes 'increment_free_vote' (the ACTUAL function used by frontend) to handle unique constraints properly.

BEGIN;

-------------------------------------------------------------------------------
-- 1. Fix add_tokens (Cause of "Database Error" in Purchase)
-------------------------------------------------------------------------------
-- DROP FIRST to allow parameter name restoration
DROP FUNCTION IF EXISTS public.add_tokens(uuid, integer);

-- MUST use 'user_id' and 'token_amount' as parameter names because 
-- Edge Function calls it via { user_id: ..., token_amount: ... }
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
  -- 1. Update existing profile
  UPDATE public.profiles
  SET tokens = COALESCE(tokens, 0) + token_amount
  WHERE id = user_id;
  
  -- 2. If user not found, auto-create profile (Safety Net)
  IF NOT FOUND THEN
    INSERT INTO public.profiles (id, tokens)
    VALUES (user_id, COALESCE(token_amount, 0));
  END IF;
END;
$$;

-- Grant permissions explicitly
GRANT EXECUTE ON FUNCTION public.add_tokens(uuid, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.add_tokens(uuid, integer) TO service_role;


-------------------------------------------------------------------------------
-- 2. Fix increment_free_vote (The function actually used by Frontend)
-------------------------------------------------------------------------------
-- DROP FIRST to ensure clean slate
DROP FUNCTION IF EXISTS public.increment_free_vote(UUID, TEXT);

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
  v_vote_date DATE;
  v_topic_record RECORD;
  v_option_index INTEGER := -1;
BEGIN
  v_user_id := auth.uid();
  v_vote_date := (NOW() AT TIME ZONE 'UTC')::DATE; -- Explicit UTC date
  
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  -- 1. Double-Check Daily Limit using the NEW correct column (vote_date)
  IF EXISTS(
    SELECT 1 FROM public.free_votes
    WHERE user_id = v_user_id
      AND topic_id = p_topic_id
      AND vote_date = v_vote_date
  ) THEN
    RAISE EXCEPTION 'Free vote already used today';
  END IF;

  -- 2. Get Topic
  SELECT * INTO v_topic_record FROM public.topics WHERE id = p_topic_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Topic not found'; END IF;
  
  -- (Optional: Check Active Status - assuming frontend handles closed topics visually)
  -- IF v_topic_record.status != 'active' OR v_topic_record.end_at < NOW() THEN
  --   RAISE EXCEPTION 'Topic has ended';
  -- END IF;

  -- 3. Find Option Index (Robust matching)
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

  -- 4. INSERT RECORD (Safe Insert with Exception Handling)
  -- This is the critical fix for "duplicate key value"
  BEGIN
    INSERT INTO public.free_votes (user_id, topic_id, option, vote_date, used_at)
    VALUES (v_user_id, p_topic_id, p_option_id, v_vote_date, NOW());
    
  EXCEPTION WHEN unique_violation THEN
    -- If we catch constraint violation here, it means race condition or re-try
    RAISE EXCEPTION 'Free vote already used today';
  END;

  -- 5. Update Topic
  UPDATE public.topics
  SET 
    options = jsonb_set(
      options,
      ARRAY[v_option_index::text, 'votes'],
      to_jsonb(COALESCE((options->v_option_index->>'votes')::INTEGER, 0) + 1)
    ),
    free_votes_count = COALESCE(free_votes_count, 0) + 1
  WHERE id = p_topic_id;

  -- 6. Add to participants
  INSERT INTO public.topic_participants (topic_id, user_id)
  VALUES (p_topic_id, v_user_id)
  ON CONFLICT DO NOTHING;

  -- 7. Log Transaction Atomically (Fixes "Missing Record" issue)
  INSERT INTO public.token_transactions (
    user_id,
    amount,
    transaction_type,
    description,
    created_at,
    metadata
  ) VALUES (
    v_user_id,
    0,
    'free_vote',
    -- Note: We can't easily get the localized title here, but we can store enough info.
    'Used daily free vote: ' || p_option_id,
    NOW(),
    jsonb_build_object('topic_id', p_topic_id, 'option_id', p_option_id)
  );

END;
$$;

GRANT EXECUTE ON FUNCTION public.increment_free_vote(UUID, TEXT) TO authenticated;

COMMIT;
