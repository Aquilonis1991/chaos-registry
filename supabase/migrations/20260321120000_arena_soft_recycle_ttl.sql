-- 觀點角鬥場：TTL 歸零改為軟回收（recycled_at），僅作者可見；旁觀者 SELECT 不到已回收列
-- 並修正 decay_arena_ttl 由 DELETE 改為標記回收

ALTER TABLE public.topic_arena_messages
  ADD COLUMN IF NOT EXISTS recycled_at TIMESTAMPTZ;

COMMENT ON COLUMN public.topic_arena_messages.recycled_at IS '存在週期歸零後系統回收時間；僅作者仍可查詢該列以顯示灰色提示卡';

DROP POLICY IF EXISTS "Arena messages readable by all" ON public.topic_arena_messages;
CREATE POLICY "Arena messages readable by all"
  ON public.topic_arena_messages FOR SELECT
  USING (recycled_at IS NULL OR user_id = auth.uid());

-- 衰減排程：TTL<=0 時標記回收，不再 DELETE
CREATE OR REPLACE FUNCTION public.decay_arena_ttl(p_minutes INTEGER DEFAULT 1)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_decay_rate INTEGER;
  v_deduction INTEGER;
  v_updated INTEGER;
  v_recycled INTEGER;
BEGIN
  SELECT COALESCE((value #>> '{}')::INT, 1) INTO v_decay_rate
  FROM public.system_config WHERE key = 'arena_natural_decay_rate' LIMIT 1;

  v_deduction := least(p_minutes, 60) * v_decay_rate;

  WITH active_topics AS (
    SELECT id FROM public.topics
    WHERE status != 'ended' AND end_at > now()
  ),
  decayed AS (
    UPDATE public.topic_arena_messages m
    SET ttl_minutes = greatest(0, m.ttl_minutes - v_deduction), updated_at = now()
    FROM active_topics t
    WHERE m.topic_id = t.id
      AND m.is_legacy = false
      AND m.recycled_at IS NULL
      AND (m.shield_until IS NULL OR m.shield_until <= now())
    RETURNING m.id
  )
  SELECT COUNT(*) INTO v_updated FROM decayed;

  WITH recycled AS (
    UPDATE public.topic_arena_messages m
    SET recycled_at = now(), ttl_minutes = 0, updated_at = now()
    FROM active_topics t
    WHERE m.topic_id = t.id
      AND m.is_legacy = false
      AND m.recycled_at IS NULL
      AND m.ttl_minutes <= 0
    RETURNING m.id
  )
  SELECT COUNT(*) INTO v_recycled FROM recycled;

  RETURN jsonb_build_object('updated', v_updated, 'recycled', v_recycled);
END;
$$;

GRANT EXECUTE ON FUNCTION public.decay_arena_ttl(INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION public.decay_arena_ttl(INTEGER) TO service_role;

-- 投票：不可對已回收留言操作（SECURITY DEFINER 會繞過 RLS）
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

  IF v_msg.recycled_at IS NOT NULL THEN
    RAISE EXCEPTION 'Message not found';
  END IF;

  SELECT * INTO v_topic FROM public.topics WHERE id = v_msg.topic_id;
  IF NOT FOUND OR v_topic.status = 'ended' OR v_topic.end_at <= now() THEN
    RAISE EXCEPTION 'Topic has ended';
  END IF;

  IF EXISTS (SELECT 1 FROM public.topic_arena_votes WHERE user_id = v_user_id AND message_id = p_message_id) THEN
    RAISE EXCEPTION 'Already voted';
  END IF;

  IF v_msg.user_id = v_user_id THEN
    RAISE EXCEPTION 'Cannot vote on own message';
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
