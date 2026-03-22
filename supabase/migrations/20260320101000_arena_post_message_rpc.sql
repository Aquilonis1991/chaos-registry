-- 觀點角鬥場：post_arena_message RPC
ALTER TABLE public.token_transactions
  DROP CONSTRAINT IF EXISTS token_transactions_transaction_type_check;
ALTER TABLE public.token_transactions
  ADD CONSTRAINT token_transactions_transaction_type_check
  CHECK (transaction_type IN (
    'ai_usage','create_topic','free_create_topic','cast_vote','cast_free_vote','free_vote',
    'watch_ad','click_native_ad','deposit','complete_mission','admin_adjustment','admin_grant',
    'extend_topic_duration','add_topic_option','arena_shield','purchase','refund'
  ));

CREATE OR REPLACE FUNCTION public.post_arena_message(
  p_topic_id UUID,
  p_content TEXT,
  p_buy_shield BOOLEAN DEFAULT false
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_topic RECORD;
  v_ttl INTEGER;
  v_shield_until TIMESTAMPTZ;
  v_shield_price INTEGER;
  v_shield_hours INTEGER;
  v_shield_bonus INTEGER;
  v_access_votes INTEGER;
  v_user_vote_count INTEGER;
  v_max_len INTEGER;
  v_user_tokens INTEGER;
  v_msg_id UUID;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  PERFORM public.check_general_rate_limit('api_general', 120);

  SELECT * INTO v_topic FROM public.topics WHERE id = p_topic_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Topic not found';
  END IF;
  IF v_topic.status = 'ended' OR v_topic.end_at <= now() THEN
    RAISE EXCEPTION 'Topic has ended';
  END IF;

  IF EXISTS (SELECT 1 FROM public.topic_arena_messages WHERE topic_id = p_topic_id AND user_id = v_user_id) THEN
    RAISE EXCEPTION 'One message per topic allowed';
  END IF;

  SELECT COALESCE((value #>> '{}')::INT, 5) INTO v_access_votes
  FROM public.system_config WHERE key = 'arena_mundane_access_votes' LIMIT 1;
  SELECT COALESCE((value #>> '{}')::INT, 100) INTO v_max_len
  FROM public.system_config WHERE key = 'arena_comment_max_length' LIMIT 1;

  SELECT (SELECT COALESCE(SUM(amount), 0)::INT FROM public.votes WHERE user_id = v_user_id AND topic_id = p_topic_id)
       + (SELECT COUNT(*)::INT FROM public.free_votes WHERE user_id = v_user_id AND topic_id = p_topic_id)
  INTO v_user_vote_count;
  v_user_vote_count := COALESCE(v_user_vote_count, 0);
  IF v_user_vote_count < v_access_votes THEN
    RAISE EXCEPTION 'Insufficient vote participation';
  END IF;

  IF p_content IS NULL OR trim(p_content) = '' THEN
    RAISE EXCEPTION 'Content required';
  END IF;
  IF char_length(trim(p_content)) > v_max_len THEN
    RAISE EXCEPTION 'Content too long';
  END IF;

  SELECT COALESCE((value #>> '{}')::INT, 180) INTO v_ttl
  FROM public.system_config WHERE key = 'arena_base_data_ttl' LIMIT 1;

  v_shield_until := NULL;
  IF p_buy_shield THEN
    SELECT COALESCE((value #>> '{}')::INT, 100) INTO v_shield_price
    FROM public.system_config WHERE key = 'arena_shield_price' LIMIT 1;
    SELECT COALESCE((value #>> '{}')::INT, 3) INTO v_shield_hours
    FROM public.system_config WHERE key = 'arena_shield_duration_hours' LIMIT 1;
    SELECT COALESCE((value #>> '{}')::INT, 180) INTO v_shield_bonus
    FROM public.system_config WHERE key = 'arena_shield_legacy_bonus' LIMIT 1;

    IF v_shield_price > 0 THEN
      SELECT tokens INTO v_user_tokens FROM public.profiles WHERE id = v_user_id FOR UPDATE;
      IF COALESCE(v_user_tokens, 0) < v_shield_price THEN
        RAISE EXCEPTION 'Insufficient tokens';
      END IF;
      UPDATE public.profiles SET tokens = COALESCE(tokens, 0) - v_shield_price WHERE id = v_user_id;
      INSERT INTO public.token_transactions (user_id, amount, transaction_type, reference_id, description)
      VALUES (v_user_id, -v_shield_price, 'arena_shield', p_topic_id, '購買觀點鎖定保險');
    END IF;

    v_shield_until := now() + (v_shield_hours || ' hours')::INTERVAL;
    v_ttl := v_ttl + COALESCE(v_shield_bonus, 0);
  END IF;

  INSERT INTO public.topic_arena_messages (topic_id, user_id, content, ttl_minutes, shield_until)
  VALUES (p_topic_id, v_user_id, trim(p_content), v_ttl, v_shield_until)
  RETURNING id INTO v_msg_id;

  RETURN jsonb_build_object('success', true, 'message_id', v_msg_id, 'ttl_minutes', v_ttl, 'shield_until', v_shield_until);
END;
$$;

GRANT EXECUTE ON FUNCTION public.post_arena_message(UUID, TEXT, BOOLEAN) TO authenticated;
NOTIFY pgrst, 'reload schema';
