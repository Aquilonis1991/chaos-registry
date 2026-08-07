-- 觀點角鬥場：鎖定保險（盾）保護期間內，留言絕對不會被下架（回收）。
--
-- 官方說明文案（arena.shieldDetailBody）承諾盾只暫停「自然衰減」，斥責仍可扣分，
-- 但目前程式碼並未保證斥責扣分後的值不會低到觸發回收：
--   1) cast_arena_vote 斥責分支對有盾留言只 floor 在 0，而 0 正是回收門檻本身。
--   2) decay_arena_ttl 的回收分支完全沒有檢查 shield_until，只要 ttl_minutes<=0
--      就會回收，不管當下是否仍在鎖定保護期內（例如透過後台手動調整 ttl 也可能觸發）。
-- 修法：
--   1) cast_arena_vote：鎖定保護中的斥責改 floor 在 1，不再讓 ttl_minutes 觸底到 0。
--   2) decay_arena_ttl：回收分支比照自然衰減分支，一併排除仍在保護期內的留言，
--      作為第二層保險——即使 ttl_minutes 透過其他管道（如後台手動調整）被打到 0，
--      只要還在保護期內就不會被回收。

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
      -- 鎖定保護中：斥責仍可扣分，但保證不會扣到「可被回收」的 0 分鐘，
      -- 確保留言在保護期內絕對不會被下架。
      v_new_ttl := greatest(1, v_new_ttl);
    END IF;
    UPDATE public.topic_arena_messages
    SET downvote_count = downvote_count + 1, ttl_minutes = v_new_ttl, updated_at = now()
    WHERE id = p_message_id;
  END IF;

  RETURN jsonb_build_object('success', true, 'vote_type', p_vote_type, 'ttl_minutes', v_new_ttl);
END;
$$;

GRANT EXECUTE ON FUNCTION public.cast_arena_vote(UUID, TEXT) TO authenticated;


-- decay_arena_ttl：回收分支加入與自然衰減分支相同的鎖定保護排除條件，
-- 作為第二層保險（例如後台手動調整 ttl_minutes 到 0 的情況）。
CREATE OR REPLACE FUNCTION public.decay_arena_ttl(p_minutes INTEGER DEFAULT 1)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_decay_rate INTEGER := 1;
  v_deduction INTEGER := 0;
  v_updated INTEGER := 0;
  v_recycled INTEGER := 0;
  v_has_recycled_at BOOLEAN := false;
BEGIN
  SELECT COALESCE((value #>> '{}')::INT, 1)
  INTO v_decay_rate
  FROM public.system_config
  WHERE key = 'arena_natural_decay_rate'
  LIMIT 1;

  v_deduction := GREATEST(0, LEAST(COALESCE(p_minutes, 1), 60) * v_decay_rate);

  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'topic_arena_messages'
      AND column_name = 'recycled_at'
  )
  INTO v_has_recycled_at;

  WITH active_topics AS (
    SELECT id
    FROM public.topics
    WHERE status != 'ended' AND end_at > now()
  ),
  decayed AS (
    UPDATE public.topic_arena_messages m
    SET ttl_minutes = GREATEST(0, m.ttl_minutes - v_deduction),
        updated_at = now()
    FROM active_topics t
    WHERE m.topic_id = t.id
      AND m.is_legacy = false
      AND (m.shield_until IS NULL OR m.shield_until <= now())
      AND (NOT v_has_recycled_at OR m.recycled_at IS NULL)
    RETURNING m.id
  )
  SELECT COUNT(*) INTO v_updated FROM decayed;

  IF v_has_recycled_at THEN
    WITH active_topics AS (
      SELECT id
      FROM public.topics
      WHERE status != 'ended' AND end_at > now()
    ),
    recycled AS (
      UPDATE public.topic_arena_messages m
      SET recycled_at = now(),
          ttl_minutes = 0,
          updated_at = now()
      FROM active_topics t
      WHERE m.topic_id = t.id
        AND m.is_legacy = false
        AND m.recycled_at IS NULL
        AND m.ttl_minutes <= 0
        AND (m.shield_until IS NULL OR m.shield_until <= now())
      RETURNING m.id
    )
    SELECT COUNT(*) INTO v_recycled FROM recycled;
  ELSE
    WITH active_topics AS (
      SELECT id
      FROM public.topics
      WHERE status != 'ended' AND end_at > now()
    ),
    removed AS (
      DELETE FROM public.topic_arena_messages m
      USING active_topics t
      WHERE m.topic_id = t.id
        AND m.is_legacy = false
        AND m.ttl_minutes <= 0
        AND (m.shield_until IS NULL OR m.shield_until <= now())
      RETURNING m.id
    )
    SELECT COUNT(*) INTO v_recycled FROM removed;
  END IF;

  RETURN jsonb_build_object(
    'updated', v_updated,
    'recycled', v_recycled,
    'mode', CASE WHEN v_has_recycled_at THEN 'soft_recycle' ELSE 'delete' END
  );
END;
$$;

-- 既有的零參數版本可能與新版回傳型別不同，CREATE OR REPLACE 無法變更回傳型別，需先 DROP。
DROP FUNCTION IF EXISTS public.decay_arena_ttl();

CREATE FUNCTION public.decay_arena_ttl()
RETURNS JSONB
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.decay_arena_ttl(1);
$$;

GRANT EXECUTE ON FUNCTION public.decay_arena_ttl(INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION public.decay_arena_ttl(INTEGER) TO service_role;
GRANT EXECUTE ON FUNCTION public.decay_arena_ttl() TO authenticated;
GRANT EXECUTE ON FUNCTION public.decay_arena_ttl() TO service_role;

NOTIFY pgrst, 'reload schema';
