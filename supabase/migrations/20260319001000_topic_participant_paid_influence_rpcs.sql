-- 參與者付費影響主題：RPC（延長投票時間 / 新增投票選項）
-- 原則：成本不可寫死、扣款以 DB 重新讀取 system_config 為準、以交易/鎖避免競態

-- 0) token_transactions 允許新的交易類型（避免 insert 失敗）
ALTER TABLE public.token_transactions
  DROP CONSTRAINT IF EXISTS token_transactions_transaction_type_check;

ALTER TABLE public.token_transactions
  ADD CONSTRAINT token_transactions_transaction_type_check
  CHECK (transaction_type IN (
    'ai_usage',
    'create_topic',
    'free_create_topic',
    'cast_vote',
    'cast_free_vote',
    'free_vote',
    'watch_ad',
    'click_native_ad',
    'deposit',
    'complete_mission',
    'admin_adjustment',
    'admin_grant',
    'extend_topic_duration',
    'add_topic_option',
    'purchase',
    'refund'
  ));

-- 1) RPC: 延長投票時間
CREATE OR REPLACE FUNCTION public.extend_topic_duration(
  p_topic_id UUID,
  p_days INTEGER
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_topic RECORD;
  v_remaining_hours NUMERIC;
  v_cost INTEGER;
  v_max_per_topic INTEGER;
  v_only_when_hours_leq INTEGER;
  v_max_days_per_action INTEGER;
  v_max_per_user INTEGER;
  v_user_tokens INTEGER;
BEGIN
  PERFORM public.check_general_rate_limit('api_general', 120);

  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF p_days NOT IN (1, 2, 3) THEN
    RAISE EXCEPTION 'Invalid days: %', p_days;
  END IF;

  -- 鎖主題（避免同時延長/新增選項競態）
  SELECT *
  INTO v_topic
  FROM public.topics
  WHERE id = p_topic_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Topic not found';
  END IF;

  -- 必須尚未結束，不可復活
  IF v_topic.status = 'ended' OR v_topic.end_at <= now() THEN
    RAISE EXCEPTION 'Topic has ended';
  END IF;

  IF COALESCE(v_topic.allow_time_extension, false) IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'Time extension is not allowed for this topic';
  END IF;

  -- 讀取 system_config（全部以 DB 為準）
  SELECT COALESCE((value #>> '{}')::INT, 3) INTO v_max_per_topic
  FROM public.system_config WHERE key = 'topic_time_extension_max_per_topic' LIMIT 1;

  SELECT COALESCE((value #>> '{}')::INT, 48) INTO v_only_when_hours_leq
  FROM public.system_config WHERE key = 'topic_time_extension_only_when_remaining_hours_leq' LIMIT 1;

  SELECT COALESCE((value #>> '{}')::INT, 3) INTO v_max_days_per_action
  FROM public.system_config WHERE key = 'topic_time_extension_max_days_per_action' LIMIT 1;

  SELECT COALESCE((value #>> '{}')::INT, 1) INTO v_max_per_user
  FROM public.system_config WHERE key = 'topic_time_extension_max_per_user' LIMIT 1;

  IF p_days > v_max_days_per_action THEN
    RAISE EXCEPTION 'Days exceed max per action: % > %', p_days, v_max_days_per_action;
  END IF;

  v_remaining_hours := EXTRACT(EPOCH FROM (v_topic.end_at - now())) / 3600.0;
  IF v_remaining_hours > v_only_when_hours_leq THEN
    RAISE EXCEPTION 'Not in extension window (remaining_hours=%, require<=%)', v_remaining_hours, v_only_when_hours_leq;
  END IF;

  IF COALESCE(v_topic.extension_count, 0) >= LEAST(COALESCE(v_topic.max_extension_count, 3), v_max_per_topic) THEN
    RAISE EXCEPTION 'Extension limit reached';
  END IF;

  -- 每用戶每主題最多 1 次（用 log 表保證）
  IF v_max_per_user >= 1 THEN
    IF EXISTS (SELECT 1 FROM public.topic_extension_logs WHERE topic_id = p_topic_id AND user_id = v_user_id) THEN
      RAISE EXCEPTION 'User has already extended this topic';
    END IF;
  END IF;

  IF p_days = 1 THEN
    SELECT (value #>> '{}')::INT INTO v_cost FROM public.system_config WHERE key = 'extend_topic_1_day_cost' LIMIT 1;
  ELSIF p_days = 2 THEN
    SELECT (value #>> '{}')::INT INTO v_cost FROM public.system_config WHERE key = 'extend_topic_2_day_cost' LIMIT 1;
  ELSE
    SELECT (value #>> '{}')::INT INTO v_cost FROM public.system_config WHERE key = 'extend_topic_3_day_cost' LIMIT 1;
  END IF;

  IF v_cost IS NULL OR v_cost <= 0 THEN
    RAISE EXCEPTION 'Cost config missing or invalid';
  END IF;

  -- 鎖使用者代幣並扣款
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

  -- 更新主題 end_at + duration_days + extension_count
  UPDATE public.topics
  SET
    end_at = end_at + make_interval(days => p_days),
    duration_days = COALESCE(duration_days, 0) + p_days,
    extension_count = COALESCE(extension_count, 0) + 1
  WHERE id = p_topic_id;

  INSERT INTO public.topic_extension_logs (topic_id, user_id, days_added, token_cost)
  VALUES (p_topic_id, v_user_id, p_days, v_cost);

  INSERT INTO public.token_transactions (user_id, amount, transaction_type, reference_id, description, metadata)
  VALUES (
    v_user_id,
    -v_cost,
    'extend_topic_duration',
    p_topic_id,
    '參與者延長投票時間',
    jsonb_build_object('days_added', p_days)
  );

  RETURN jsonb_build_object(
    'success', true,
    'topic_id', p_topic_id,
    'days_added', p_days,
    'token_cost', v_cost
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.extend_topic_duration(UUID, INTEGER) TO authenticated;

-- 2) RPC: 新增投票選項（寫入 topics.options JSONB）
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

-- 刷新 Schema Cache（PostgREST）
NOTIFY pgrst, 'reload schema';

