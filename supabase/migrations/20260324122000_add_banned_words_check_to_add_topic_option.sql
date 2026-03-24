-- 參與者新增選項：新增禁字檢查（後端強制）
-- 規則與發起主題一致，預設檢查等級 A~E，允許由 topic_banned_check_levels 覆蓋

CREATE OR REPLACE FUNCTION public.add_topic_option(
  p_topic_id UUID,
  p_option_text TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_topic RECORD;
  v_cost INTEGER;
  v_max_per_topic INTEGER;
  v_max_per_user INTEGER;
  v_min_len INTEGER;
  v_max_len INTEGER;
  v_existing_count INTEGER;
  v_user_added_count INTEGER;
  v_new_id TEXT;
  v_trimmed TEXT;
  v_user_tokens INTEGER;
  v_banned RECORD;
  v_banned_levels_json JSONB;
  v_check_levels TEXT[] := ARRAY['A','B','C','D','E'];
BEGIN
  PERFORM public.check_general_rate_limit('api_general', 120);

  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  v_trimmed := btrim(COALESCE(p_option_text, ''));
  IF v_trimmed = '' THEN
    RAISE EXCEPTION 'Option text is empty';
  END IF;

  -- 鎖主題
  SELECT *
  INTO v_topic
  FROM public.topics
  WHERE id = p_topic_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Topic not found';
  END IF;

  IF v_topic.status = 'ended' OR v_topic.end_at <= now() THEN
    RAISE EXCEPTION 'Topic has ended';
  END IF;

  IF COALESCE(v_topic.allow_option_addition, false) IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'Option addition is not allowed for this topic';
  END IF;

  -- config
  SELECT COALESCE((value #>> '{}')::INT, 40) INTO v_cost
  FROM public.system_config WHERE key = 'add_topic_option_cost' LIMIT 1;

  SELECT COALESCE((value #>> '{}')::INT, 5) INTO v_max_per_topic
  FROM public.system_config WHERE key = 'topic_option_add_max_per_topic' LIMIT 1;

  SELECT COALESCE((value #>> '{}')::INT, 1) INTO v_max_per_user
  FROM public.system_config WHERE key = 'topic_option_add_max_per_user' LIMIT 1;

  SELECT COALESCE((value #>> '{}')::INT, 2) INTO v_min_len
  FROM public.system_config WHERE key = 'topic_option_add_min_length' LIMIT 1;

  SELECT COALESCE((value #>> '{}')::INT, 20) INTO v_max_len
  FROM public.system_config WHERE key = 'topic_option_add_max_length' LIMIT 1;

  IF v_cost IS NULL OR v_cost <= 0 THEN
    RAISE EXCEPTION 'Cost config missing or invalid';
  END IF;

  IF char_length(v_trimmed) < v_min_len OR char_length(v_trimmed) > v_max_len THEN
    RAISE EXCEPTION 'Option length out of range';
  END IF;

  -- 禁字檢查（與發起主題一致的檢查級別）
  SELECT value INTO v_banned_levels_json
  FROM public.system_config
  WHERE key = 'topic_banned_check_levels'
  LIMIT 1;

  IF v_banned_levels_json IS NOT NULL
     AND jsonb_typeof(v_banned_levels_json) = 'array' THEN
    SELECT COALESCE(array_agg(level), v_check_levels)
    INTO v_check_levels
    FROM jsonb_array_elements_text(v_banned_levels_json) AS x(level);
  END IF;

  SELECT * INTO v_banned
  FROM public.check_banned_words(v_trimmed, v_check_levels)
  LIMIT 1;

  IF COALESCE(v_banned.found, false) AND COALESCE(v_banned.action, 'block') IN ('block', 'mask') THEN
    RAISE EXCEPTION 'Option contains banned word: %', COALESCE(v_banned.keyword, '');
  END IF;

  -- existing options count / duplicate check（支援 string 或 object(text/label)）
  SELECT COALESCE(jsonb_array_length(COALESCE(v_topic.options, '[]'::jsonb)), 0) INTO v_existing_count;
  IF v_existing_count >= v_max_per_topic THEN
    RAISE EXCEPTION 'Option count limit reached';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM jsonb_array_elements(COALESCE(v_topic.options, '[]'::jsonb)) e
    WHERE
      (jsonb_typeof(e) = 'string' AND lower(e::text) = lower(to_jsonb(v_trimmed)::text))
      OR
      (jsonb_typeof(e) = 'object' AND lower(COALESCE(e->>'text', e->>'label', '')) = lower(v_trimmed))
  ) THEN
    RAISE EXCEPTION 'Duplicate option';
  END IF;

  -- per-user limit via logs
  SELECT COUNT(*) INTO v_user_added_count
  FROM public.topic_option_logs
  WHERE topic_id = p_topic_id AND user_id = v_user_id;

  IF v_user_added_count >= v_max_per_user THEN
    RAISE EXCEPTION 'User option add limit reached';
  END IF;

  -- 扣款（鎖使用者）
  SELECT tokens INTO v_user_tokens
  FROM public.profiles
  WHERE id = v_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'User profile not found';
  END IF;

  IF COALESCE(v_user_tokens, 0) < v_cost THEN
    RAISE EXCEPTION 'Insufficient tokens';
  END IF;

  UPDATE public.profiles
  SET tokens = COALESCE(tokens, 0) - v_cost
  WHERE id = v_user_id;

  -- append option
  v_new_id := 'uopt-' || replace(gen_random_uuid()::text, '-', '');

  UPDATE public.topics
  SET options = COALESCE(options, '[]'::jsonb) || jsonb_build_array(
    jsonb_build_object(
      'id', v_new_id,
      'text', v_trimmed,
      'votes', 0,
      'is_user_added', true,
      'created_by_user_id', v_user_id,
      'status', 'active'
    )
  )
  WHERE id = p_topic_id;

  INSERT INTO public.topic_option_logs (topic_id, user_id, option_text, token_cost)
  VALUES (p_topic_id, v_user_id, v_trimmed, v_cost);

  INSERT INTO public.token_transactions (user_id, amount, transaction_type, reference_id, description, metadata)
  VALUES (
    v_user_id,
    -v_cost,
    'add_topic_option',
    p_topic_id,
    '參與者新增投票選項',
    jsonb_build_object('option_id', v_new_id, 'option_text', v_trimmed)
  );

  RETURN jsonb_build_object(
    'success', true,
    'topic_id', p_topic_id,
    'option_id', v_new_id,
    'option_text', v_trimmed,
    'token_cost', v_cost
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.add_topic_option(UUID, TEXT) TO authenticated;
NOTIFY pgrst, 'reload schema';
