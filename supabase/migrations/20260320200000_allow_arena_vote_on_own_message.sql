-- 允許對自己的觀點留言贊同／斥責（移除「不可投自己」限制）
CREATE OR REPLACE FUNCTION public.cast_arena_vote(
  p_message_id UUID,
  p_vote_type TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_msg RECORD;
  v_topic RECORD;
  v_bonus INTEGER;
  v_penalty INTEGER;
  v_new_ttl INTEGER;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  PERFORM public.check_general_rate_limit('api_general', 120);

  IF p_vote_type NOT IN ('upvote', 'downvote') THEN
    RAISE EXCEPTION 'Invalid vote type';
  END IF;

  SELECT * INTO v_msg FROM public.topic_arena_messages WHERE id = p_message_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Message not found';
  END IF;

  SELECT * INTO v_topic FROM public.topics WHERE id = v_msg.topic_id;
  IF NOT FOUND OR v_topic.status = 'ended' OR v_topic.end_at <= now() THEN
    RAISE EXCEPTION 'Topic has ended';
  END IF;

  IF EXISTS (SELECT 1 FROM public.topic_arena_votes WHERE user_id = v_user_id AND message_id = p_message_id) THEN
    RAISE EXCEPTION 'Already voted';
  END IF;

  SELECT COALESCE((value #>> '{}')::INT, 10) INTO v_bonus
  FROM public.system_config WHERE key = 'arena_upvote_time_bonus' LIMIT 1;
  SELECT COALESCE((value #>> '{}')::INT, 12) INTO v_penalty
  FROM public.system_config WHERE key = 'arena_downvote_time_penalty' LIMIT 1;

  INSERT INTO public.topic_arena_votes (user_id, message_id, vote_type)
  VALUES (v_user_id, p_message_id, p_vote_type);

  IF p_vote_type = 'upvote' THEN
    v_new_ttl := v_msg.ttl_minutes + v_bonus;
    UPDATE public.topic_arena_messages
    SET upvote_count = upvote_count + 1, ttl_minutes = v_new_ttl, updated_at = now()
    WHERE id = p_message_id;
  ELSE
    v_new_ttl := v_msg.ttl_minutes - v_penalty;
    IF v_msg.shield_until IS NOT NULL AND v_msg.shield_until > now() THEN
      v_new_ttl := greatest(0, v_new_ttl);
    END IF;
    UPDATE public.topic_arena_messages
    SET downvote_count = downvote_count + 1, ttl_minutes = v_new_ttl, updated_at = now()
    WHERE id = p_message_id;
  END IF;

  RETURN jsonb_build_object('success', true, 'vote_type', p_vote_type, 'ttl_minutes', v_new_ttl);
END;
$$;

GRANT EXECUTE ON FUNCTION public.cast_arena_vote(UUID, TEXT) TO authenticated;
NOTIFY pgrst, 'reload schema';
