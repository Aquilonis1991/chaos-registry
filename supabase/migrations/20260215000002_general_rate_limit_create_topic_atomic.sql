-- 自 20260215000000 拆分：create_topic_atomic

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
  PERFORM public.check_general_rate_limit('api_general', 120);

  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'User not authenticated';
  END IF;

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

  IF p_total_cost > 0 THEN
    UPDATE public.profiles
    SET tokens = tokens - p_total_cost
    WHERE id = v_user_id;
  END IF;

  INSERT INTO public.topics (
    creator_id, title, description, options, tags, category,
    exposure_level, duration_days, end_at, status, votes, created_at, updated_at
  ) VALUES (
    v_user_id, p_title, p_description, p_options, p_tags, p_category,
    p_exposure_level, p_duration_days, p_end_at, 'active', '{}'::JSONB, NOW(), NOW()
  )
  RETURNING id INTO v_topic_id;

  IF p_total_cost > 0 THEN
    INSERT INTO public.token_transactions (
      user_id, amount, transaction_type, reference_id, description, metadata
    ) VALUES (
      v_user_id, -p_total_cost, 'create_topic', v_topic_id, p_description_token_transfer,
      jsonb_build_object('topic_title', p_title)
    )
    RETURNING id INTO v_transaction_id;
  END IF;

  RETURN jsonb_build_object('success', true, 'topic_id', v_topic_id, 'transaction_id', v_transaction_id);
END;
$$;
