-- 一般請求定時上限：依 identifier（user_id 或 anon）與 action_type 統計每分鐘請求次數，超過則拒絕。
--
-- 建議預設值（可依需求在 check_general_rate_limit 第二參數調整）：
--   api_general：120 次/分鐘/人（或 anon 共用一桶）
-- 若單一 RPC 需更嚴：例如 check_general_rate_limit('api_general', 60)
-- 若需更鬆：例如 check_general_rate_limit('api_general', 200)

-- 1. 表：每 (identifier, action_type) 每分鐘一個 bucket
CREATE TABLE IF NOT EXISTS public.general_rate_limits (
  identifier TEXT NOT NULL,
  action_type TEXT NOT NULL,
  window_start TIMESTAMPTZ NOT NULL,
  request_count INT NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (identifier, action_type)
);

CREATE INDEX IF NOT EXISTS idx_general_rate_limits_updated
  ON public.general_rate_limits (updated_at);

COMMENT ON TABLE public.general_rate_limits IS '一般 API 請求 rate limit：每 identifier+action_type 每分鐘 request_count 不超過設定上限';

-- 2. 檢查函數：未超過上限則將計數 +1，超過則拋錯
CREATE OR REPLACE FUNCTION public.check_general_rate_limit(
  p_action_type TEXT,
  p_max_per_minute INT DEFAULT 120
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_identifier TEXT;
  v_window    TIMESTAMPTZ;
  v_count     INT;
BEGIN
  v_identifier := COALESCE(auth.uid()::TEXT, 'anon');
  v_window     := date_trunc('minute', NOW());

  INSERT INTO public.general_rate_limits (identifier, action_type, window_start, request_count, updated_at)
  VALUES (v_identifier, p_action_type, v_window, 1, NOW())
  ON CONFLICT (identifier, action_type)
  DO UPDATE SET
    request_count = CASE
      WHEN general_rate_limits.window_start = v_window
        THEN general_rate_limits.request_count + 1
      ELSE 1
    END,
    window_start = CASE
      WHEN general_rate_limits.window_start = v_window
        THEN general_rate_limits.window_start
      ELSE v_window
    END,
    updated_at = NOW();

  SELECT request_count INTO v_count
  FROM public.general_rate_limits
  WHERE identifier = v_identifier AND action_type = p_action_type AND window_start = v_window;

  IF v_count > p_max_per_minute THEN
    RAISE EXCEPTION 'Rate limit exceeded. Try again later.'
      USING ERRCODE = 'P0001';
  END IF;
END;
$$;

-- 僅允許透過 RPC 使用（authenticated / anon 會經由其他 RPC 呼叫此函數）
GRANT EXECUTE ON FUNCTION public.check_general_rate_limit(TEXT, INT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.check_general_rate_limit(TEXT, INT) TO anon;

-- RLS：啟用後預設拒絕所有角色；僅 table owner 與 SECURITY DEFINER 函數（同 owner）可寫入
ALTER TABLE public.general_rate_limits ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- 3. 在關鍵 RPC 開頭加入一般請求上限檢查（建議預設：120 次/分鐘）
-- 以下覆寫既有函數，僅在開頭多一行 PERFORM check_general_rate_limit('api_general', 120);
-- ---------------------------------------------------------------------------

-- 3.1 log_token_transaction
CREATE OR REPLACE FUNCTION public.log_token_transaction(
  p_user_id UUID,
  p_amount INTEGER,
  p_transaction_type TEXT,
  p_reference_id UUID DEFAULT NULL,
  p_description TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_transaction_id UUID;
  v_allowed_types TEXT[] := ARRAY[
    'create_topic',
    'free_create_topic',
    'cast_vote',
    'cast_free_vote',
    'free_vote',
    'complete_mission',
    'watch_ad',
    'admin_adjustment',
    'purchase'
  ];
BEGIN
  PERFORM public.check_general_rate_limit('api_general', 120);

  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'User must be authenticated';
  END IF;
  IF auth.uid() != p_user_id THEN
    RAISE EXCEPTION 'User can only log transactions for themselves';
  END IF;
  IF NOT (p_transaction_type = ANY(v_allowed_types)) THEN
    RAISE EXCEPTION 'Invalid transaction type: %', p_transaction_type;
  END IF;

  INSERT INTO public.token_transactions (
    user_id, amount, transaction_type, reference_id, description
  )
  VALUES (
    p_user_id, p_amount, p_transaction_type, p_reference_id, p_description
  )
  RETURNING id INTO v_transaction_id;
  RETURN v_transaction_id;
END;
$$;

-- 3.2 create_topic_atomic（若專案中已有此函數則會被覆寫）
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
GRANT EXECUTE ON FUNCTION public.create_topic_atomic TO authenticated;

-- 3.3 increment_option_votes
CREATE OR REPLACE FUNCTION public.increment_option_votes(
  p_topic_id UUID,
  p_option_id TEXT,
  p_vote_amount INTEGER
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_topic_status TEXT;
  v_end_at TIMESTAMPTZ;
  v_options JSONB;
  v_option_index INTEGER := -1;
BEGIN
  PERFORM public.check_general_rate_limit('api_general', 120);

  SELECT status, end_at, options INTO v_topic_status, v_end_at, v_options
  FROM public.topics
  WHERE id = p_topic_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Topic not found';
  END IF;
  IF v_topic_status = 'ended' OR v_end_at <= now() THEN
    RAISE EXCEPTION 'Topic has ended';
  END IF;

  FOR i IN 0..jsonb_array_length(v_options) - 1 LOOP
    IF (v_options->i->>'id') = p_option_id
       OR ((v_options->i->>'id') IS NULL AND p_option_id = 'option-' || i::text) THEN
      v_option_index := i;
      EXIT;
    END IF;
  END LOOP;
  IF v_option_index = -1 THEN
    RAISE EXCEPTION 'Option not found: %', p_option_id;
  END IF;

  UPDATE public.topics
  SET
    options = jsonb_set(
      options,
      ARRAY[v_option_index::text, 'votes'],
      to_jsonb(COALESCE((options->v_option_index->>'votes')::INTEGER, 0) + p_vote_amount)
    ),
    total_votes = COALESCE(total_votes, 0) + p_vote_amount
  WHERE id = p_topic_id;
END;
$$;
GRANT EXECUTE ON FUNCTION public.increment_option_votes(UUID, TEXT, INTEGER) TO authenticated;

-- 3.4 increment_free_vote
CREATE OR REPLACE FUNCTION public.increment_free_vote(
  p_topic_id UUID,
  p_option_id TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_topic_record RECORD;
  v_option_index INTEGER := -1;
  v_already_used BOOLEAN;
BEGIN
  PERFORM public.check_general_rate_limit('api_general', 120);

  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  SELECT EXISTS(
    SELECT 1 FROM public.free_votes
    WHERE user_id = v_user_id AND topic_id = p_topic_id AND used_at >= CURRENT_DATE
  ) INTO v_already_used;
  IF v_already_used THEN
    RAISE EXCEPTION 'Free vote already used today';
  END IF;

  SELECT * INTO v_topic_record FROM public.topics WHERE id = p_topic_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Topic not found'; END IF;
  IF v_topic_record.status != 'active' OR v_topic_record.end_at < NOW() THEN
    RAISE EXCEPTION 'Topic has ended';
  END IF;

  FOR i IN 0..jsonb_array_length(v_topic_record.options) - 1 LOOP
    IF (v_topic_record.options->i->>'id') = p_option_id
       OR ((v_topic_record.options->i->>'id') IS NULL AND p_option_id = 'option-' || i::text) THEN
      v_option_index := i;
      EXIT;
    END IF;
  END LOOP;
  IF v_option_index = -1 THEN RAISE EXCEPTION 'Option not found: %', p_option_id; END IF;

  UPDATE public.topics
  SET
    options = jsonb_set(
      options,
      ARRAY[v_option_index::text, 'votes'],
      to_jsonb(COALESCE((options->v_option_index->>'votes')::INTEGER, 0) + 1)
    ),
    total_votes = COALESCE(total_votes, 0) + 1
  WHERE id = p_topic_id;

  INSERT INTO public.free_votes (user_id, topic_id, option_id, used_at)
  VALUES (v_user_id, p_topic_id, p_option_id, NOW());
END;
$$;
GRANT EXECUTE ON FUNCTION public.increment_free_vote(UUID, TEXT) TO authenticated;
