-- 觀點角鬥場：修正「留言已到期但尚未被排程回收」時無法立即重發的問題
-- 作法：post_arena_message 先嘗試回收「該使用者在該主題已實際到期」的 active 留言，
--      再做 one-per-topic(active) 檢查，避免前端顯示已歸零但後端仍阻擋發文。

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
  v_from_tx INTEGER;
  v_from_votes INTEGER;
  v_free_count INTEGER;
  v_max_len INTEGER;
  v_user_tokens INTEGER;
  v_msg_id UUID;
  v_banned RECORD;
  v_arena_banned_levels_json JSONB;
  v_arena_check_levels TEXT[] := ARRAY['A','B','C','D','E'];
  v_decay_rate INTEGER;
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

  -- 先讀衰減速率，供「即時到期回收」判定
  SELECT COALESCE((value #>> '{}')::INT, 1) INTO v_decay_rate
  FROM public.system_config
  WHERE key = 'arena_natural_decay_rate'
  LIMIT 1;

  -- 即時回收：針對該 user+topic，若 active 留言已達到/低於 0 分鐘，先標記回收
  UPDATE public.topic_arena_messages m
  SET recycled_at = now(),
      ttl_minutes = 0,
      updated_at = now()
  WHERE m.topic_id = p_topic_id
    AND m.user_id = v_user_id
    AND m.recycled_at IS NULL
    AND (m.shield_until IS NULL OR m.shield_until <= now())
    AND GREATEST(
      0,
      m.ttl_minutes - (
        FLOOR(EXTRACT(EPOCH FROM (now() - COALESCE(m.updated_at, m.created_at))) / 60)::INT
        * v_decay_rate
      )
    ) <= 0;

  -- 僅阻擋 active 留言；回收(recycled_at)後可再次發表
  IF EXISTS (
    SELECT 1
    FROM public.topic_arena_messages
    WHERE topic_id = p_topic_id
      AND user_id = v_user_id
      AND recycled_at IS NULL
  ) THEN
    RAISE EXCEPTION 'One message per topic allowed';
  END IF;

  SELECT COALESCE((value #>> '{}')::INT, 5) INTO v_access_votes
  FROM public.system_config WHERE key = 'arena_mundane_access_votes' LIMIT 1;
  SELECT COALESCE((value #>> '{}')::INT, 100) INTO v_max_len
  FROM public.system_config WHERE key = 'arena_comment_max_length' LIMIT 1;

  -- 付費投票：以 cast_vote 交易加總（通常 amount 為負，取絕對值）
  SELECT COALESCE(SUM(ABS(amount))::INT, 0) INTO v_from_tx
  FROM public.token_transactions
  WHERE user_id = v_user_id
    AND reference_id = p_topic_id
    AND transaction_type = 'cast_vote';

  -- votes 表單筆累計（舊資料或與交易並存時取較大者，避免低估）
  SELECT COALESCE(SUM(amount), 0)::INT INTO v_from_votes
  FROM public.votes
  WHERE user_id = v_user_id AND topic_id = p_topic_id;

  SELECT COALESCE(COUNT(*)::INT, 0) INTO v_free_count
  FROM public.free_votes
  WHERE user_id = v_user_id AND topic_id = p_topic_id;

  v_user_vote_count := COALESCE(GREATEST(COALESCE(v_from_tx, 0), COALESCE(v_from_votes, 0)), 0) + COALESCE(v_free_count, 0);

  IF v_user_vote_count < v_access_votes THEN
    RAISE EXCEPTION 'Insufficient vote participation';
  END IF;

  IF p_content IS NULL OR trim(p_content) = '' THEN
    RAISE EXCEPTION 'Content required';
  END IF;
  IF char_length(trim(p_content)) > v_max_len THEN
    RAISE EXCEPTION 'Content too long';
  END IF;

  -- 留言禁字檢查：預設 A~E，可由 arena_banned_check_levels 覆蓋
  SELECT value INTO v_arena_banned_levels_json
  FROM public.system_config
  WHERE key = 'arena_banned_check_levels'
  LIMIT 1;

  IF v_arena_banned_levels_json IS NOT NULL
     AND jsonb_typeof(v_arena_banned_levels_json) = 'array' THEN
    SELECT COALESCE(array_agg(level), v_arena_check_levels)
    INTO v_arena_check_levels
    FROM jsonb_array_elements_text(v_arena_banned_levels_json) AS x(level);
  END IF;

  SELECT * INTO v_banned
  FROM public.check_banned_words(trim(p_content), v_arena_check_levels)
  LIMIT 1;

  -- 僅 block / mask 擋下；review 允許寫入（前端已顯示警告並由使用者確認）
  IF COALESCE(v_banned.found, false) AND COALESCE(v_banned.action, 'block') IN ('block', 'mask') THEN
    RAISE EXCEPTION 'Content contains banned word: %', COALESCE(v_banned.keyword, '');
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

