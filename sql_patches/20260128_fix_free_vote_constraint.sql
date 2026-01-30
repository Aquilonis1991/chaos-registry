-- FIX FREE VOTE CONSTRAINT VIOLATION & ENSURE PURCHASE IDEMPOTENCY
-- Date: 2026-01-28

BEGIN;

-- 1. Fix cast_free_vote uniqueness handling (Race Condition Fix)
CREATE OR REPLACE FUNCTION public.cast_free_vote(
  p_topic_id UUID,
  p_option TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
BEGIN
  -- Get current user
  v_user_id := auth.uid();
  
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'User not authenticated');
  END IF;

  -- Double-check before insert (Reduced race condition window, but still needs DB constraint safety)
  IF EXISTS (
    SELECT 1 FROM public.free_votes 
    WHERE user_id = v_user_id AND topic_id = p_topic_id AND DATE(used_at) = CURRENT_DATE
  ) THEN
     RETURN jsonb_build_object('success', false, 'error', 'Free vote already used today for this topic');
  END IF;

  -- Insert free vote record with SAFE handling
  -- If race condition happens here, ON CONFLICT will catch it
  BEGIN
    INSERT INTO public.free_votes (user_id, topic_id, option)
    VALUES (v_user_id, p_topic_id, p_option);
    
  EXCEPTION WHEN unique_violation THEN
    -- If we hit the constraint, it means we were beaten by another request
    RETURN jsonb_build_object('success', false, 'error', 'Free vote already used today for this topic');
  END;

  -- Update topic votes (add 1 vote to the option)
  UPDATE public.topics
  SET votes = jsonb_set(
    votes,
    ARRAY[p_option],
    COALESCE((votes->p_option)::integer, 0) + 1
  )
  WHERE id = p_topic_id;

  -- Log transaction (Safe insert)
  INSERT INTO public.token_transactions (
    user_id,
    amount,
    transaction_type,
    description
  ) VALUES (
    v_user_id,
    0,
    'free_vote',
    'Used daily free vote'
  );

  -- Log audit
  INSERT INTO public.audit_logs (
    user_id,
    action,
    resource_type,
    metadata
  ) VALUES (
    v_user_id,
    'free_vote',
    'topic',
    jsonb_build_object(
      'topic_id', p_topic_id,
      'option', p_option,
      'amount', 0
    )
  );

  RETURN jsonb_build_object('success', true, 'message', 'Free vote cast successfully');
END;
$$;

COMMIT;
