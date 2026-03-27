-- Arena recycled snapshot language hardening:
-- 1) Persist message language at post time (default zh)
-- 2) Freeze recycled canned body using latest ui_texts at snapshot moment
-- 3) Pick canned language by message language (zh/en/ja), fallback zh

ALTER TABLE public.topic_arena_messages
  ADD COLUMN IF NOT EXISTS message_language TEXT;

UPDATE public.topic_arena_messages
SET message_language = 'zh'
WHERE message_language IS NULL OR message_language NOT IN ('zh', 'en', 'ja');

ALTER TABLE public.topic_arena_messages
  ALTER COLUMN message_language SET DEFAULT 'zh';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'topic_arena_messages_language_check'
      AND conrelid = 'public.topic_arena_messages'::regclass
  ) THEN
    ALTER TABLE public.topic_arena_messages
      ADD CONSTRAINT topic_arena_messages_language_check
      CHECK (message_language IN ('zh', 'en', 'ja'));
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.post_arena_message(
  p_topic_id UUID,
  p_content TEXT,
  p_buy_shield BOOLEAN DEFAULT false,
  p_language TEXT DEFAULT 'zh'
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
  v_language TEXT := 'zh';
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  v_language := LOWER(COALESCE(BTRIM(p_language), 'zh'));
  IF v_language NOT IN ('zh', 'en', 'ja') THEN
    v_language := 'zh';
  END IF;

  PERFORM public.check_general_rate_limit('api_general', 120);

  SELECT * INTO v_topic FROM public.topics WHERE id = p_topic_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Topic not found';
  END IF;
  IF v_topic.status = 'ended' OR v_topic.end_at <= now() THEN
    RAISE EXCEPTION 'Topic has ended';
  END IF;

  SELECT COALESCE((value #>> '{}')::INT, 1) INTO v_decay_rate
  FROM public.system_config
  WHERE key = 'arena_natural_decay_rate'
  LIMIT 1;

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

  SELECT COALESCE(SUM(ABS(amount))::INT, 0) INTO v_from_tx
  FROM public.token_transactions
  WHERE user_id = v_user_id
    AND reference_id = p_topic_id
    AND transaction_type = 'cast_vote';

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

  INSERT INTO public.topic_arena_messages (topic_id, user_id, content, ttl_minutes, shield_until, message_language)
  VALUES (p_topic_id, v_user_id, trim(p_content), v_ttl, v_shield_until, v_language)
  RETURNING id INTO v_msg_id;

  RETURN jsonb_build_object('success', true, 'message_id', v_msg_id, 'ttl_minutes', v_ttl, 'shield_until', v_shield_until);
END;
$$;

CREATE OR REPLACE FUNCTION public.finalize_arena_recycled_snapshots(p_message_ids UUID[])
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_decay_rate INTEGER := 1;
  v_mid UUID;
  v_msg RECORD;
  v_last_upvoter_name TEXT;
  v_approver_name TEXT;
  v_variant INTEGER;
  v_tpl TEXT;
  v_body TEXT;
  v_lang TEXT;
  v_updated_count INTEGER := 0;
BEGIN
  IF p_message_ids IS NULL OR array_length(p_message_ids, 1) IS NULL THEN
    RETURN 0;
  END IF;

  SELECT COALESCE((value #>> '{}')::INT, 1)
  INTO v_decay_rate
  FROM public.system_config
  WHERE key = 'arena_natural_decay_rate'
  LIMIT 1;

  FOREACH v_mid IN ARRAY p_message_ids
  LOOP
    SELECT
      m.id,
      m.upvote_count,
      m.downvote_count,
      m.ttl_minutes,
      m.shield_until,
      m.created_at,
      m.updated_at,
      m.recycled_at,
      m.message_language,
      m.recycled_body_snapshot,
      m.recycled_approver_name_snapshot
    INTO v_msg
    FROM public.topic_arena_messages m
    WHERE m.id = v_mid
    FOR UPDATE;

    IF NOT FOUND THEN
      CONTINUE;
    END IF;

    IF v_msg.recycled_body_snapshot IS NOT NULL
       AND v_msg.recycled_approver_name_snapshot IS NOT NULL THEN
      CONTINUE;
    END IF;

    IF NOT (
      v_msg.recycled_at IS NOT NULL
      OR (
        (v_msg.shield_until IS NULL OR v_msg.shield_until <= now())
        AND GREATEST(
          0,
          v_msg.ttl_minutes - (
            FLOOR(EXTRACT(EPOCH FROM (now() - COALESCE(v_msg.updated_at, v_msg.created_at))) / 60)::INT
            * v_decay_rate
          )
        ) <= 0
      )
    ) THEN
      CONTINUE;
    END IF;

    SELECT p.nickname
    INTO v_last_upvoter_name
    FROM public.topic_arena_votes v
    JOIN public.profiles p ON p.id = v.user_id
    WHERE v.message_id = v_msg.id
      AND v.vote_type = 'upvote'
    ORDER BY v.created_at DESC
    LIMIT 1;

    v_approver_name := COALESCE(NULLIF(BTRIM(v_last_upvoter_name), ''), '系統自動回收');

    v_variant := (ABS((('x' || SUBSTRING(md5(v_msg.id::TEXT), 1, 8))::bit(32)::INT)) % 20) + 1;
    v_lang := LOWER(COALESCE(NULLIF(BTRIM(v_msg.message_language), ''), 'zh'));
    IF v_lang NOT IN ('zh', 'en', 'ja') THEN
      v_lang := 'zh';
    END IF;

    SELECT
      CASE v_lang
        WHEN 'en' THEN COALESCE(NULLIF(BTRIM(ut.en), ''), NULLIF(BTRIM(ut.zh), ''), NULLIF(BTRIM(ut.value), ''))
        WHEN 'ja' THEN COALESCE(NULLIF(BTRIM(ut.ja), ''), NULLIF(BTRIM(ut.zh), ''), NULLIF(BTRIM(ut.value), ''))
        ELSE COALESCE(NULLIF(BTRIM(ut.zh), ''), NULLIF(BTRIM(ut.value), ''))
      END
    INTO v_tpl
    FROM public.ui_texts ut
    WHERE ut.key = format('arena.recycledBody.%s', v_variant)
    LIMIT 1;

    IF v_tpl IS NULL THEN
      v_tpl := '您的留言存在週期已歸零。系統執行回收。最終結果：👍贊同 {{up}} / 👎斥責 {{down}}，感謝您發表廢話。';
    END IF;

    v_body := replace(replace(v_tpl, '{{up}}', v_msg.upvote_count::TEXT), '{{down}}', v_msg.downvote_count::TEXT);

    UPDATE public.topic_arena_messages
    SET
      recycled_body_snapshot = COALESCE(recycled_body_snapshot, v_body),
      recycled_approver_name_snapshot = COALESCE(recycled_approver_name_snapshot, v_approver_name),
      recycled_snapshot_at = COALESCE(recycled_snapshot_at, now()),
      updated_at = now()
    WHERE id = v_msg.id;

    v_updated_count := v_updated_count + 1;
  END LOOP;

  RETURN v_updated_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.post_arena_message(UUID, TEXT, BOOLEAN, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.finalize_arena_recycled_snapshots(UUID[]) TO authenticated;
NOTIFY pgrst, 'reload schema';
