-- ========================================
-- 20251120 曝光系統調整
-- ========================================
-- 說明：
-- 1. 主題建立後立即依 topics.exposure_level 套用曝光權重，排序不再依賴 exposure_applications。
-- 2. 申請曝光改為僅能從低等升級到高等，且只需補差額代幣。
-- 3. 曝光申請紀錄僅作為升級紀錄，用於每日/全站次數限制與冷卻期判斷。
-- ========================================

-- 1. 熱門分數改為直接讀取 topics.exposure_level
CREATE OR REPLACE FUNCTION public.get_topic_exposure_score(p_topic_id UUID)
RETURNS NUMERIC AS $$
DECLARE
  v_exposure_level TEXT;
  v_created_at TIMESTAMPTZ;
  v_weight NUMERIC := 1.0;
  v_vote_count INTEGER := 0;
  v_base_popularity NUMERIC := 0;
  v_hours_since_creation NUMERIC := 0;
BEGIN
  SELECT exposure_level, created_at
  INTO v_exposure_level, v_created_at
  FROM public.topics
  WHERE id = p_topic_id;

  IF v_exposure_level IS NULL THEN
    RETURN 0;
  END IF;

  v_weight := public.get_exposure_weight(v_exposure_level);

  SELECT COALESCE(
    (SELECT SUM((value->>'votes')::INTEGER)
     FROM jsonb_array_elements((SELECT options FROM public.topics WHERE id = p_topic_id)) AS value),
    0
  ) INTO v_vote_count;

  v_base_popularity := LOG(GREATEST(v_vote_count, 1) + 1);
  v_hours_since_creation := EXTRACT(EPOCH FROM (now() - COALESCE(v_created_at, now()))) / 3600;

  RETURN (v_base_popularity * 0.5)
       + (v_vote_count * 0.3)
       + (v_weight * 100 * 0.2)
       - (v_hours_since_creation * 0.02);
END;
$$ LANGUAGE plpgsql STABLE;

-- 2. 熱門列表直接輸出目前曝光等級
CREATE OR REPLACE FUNCTION public.get_hot_topics_with_exposure(
  p_limit INTEGER DEFAULT 20,
  p_offset INTEGER DEFAULT 0
)
RETURNS TABLE (
  id UUID,
  title TEXT,
  description TEXT,
  tags TEXT[],
  creator_id UUID,
  exposure_level TEXT,
  duration_days INTEGER,
  created_at TIMESTAMPTZ,
  end_at TIMESTAMPTZ,
  status TEXT,
  options JSONB,
  total_votes INTEGER,
  exposure_score NUMERIC,
  current_exposure_level TEXT,
  exposure_expires_at TIMESTAMPTZ
) AS $$
DECLARE
  v_grace_days INTEGER := 3;
  v_grace_interval INTERVAL := INTERVAL '3 days';
BEGIN
  SELECT (value #>> '{}')::INTEGER
  INTO v_grace_days
  FROM public.system_config
  WHERE key = 'home_expired_topic_grace_days'
  LIMIT 1;

  IF v_grace_days IS NULL THEN
    v_grace_days := 3;
  END IF;

  v_grace_days := GREATEST(v_grace_days, 0);
  v_grace_interval := make_interval(days => v_grace_days);

  RETURN QUERY
  SELECT
    t.id,
    t.title,
    t.description,
    t.tags,
    t.creator_id,
    t.exposure_level,
    t.duration_days,
    t.created_at,
    t.end_at,
    t.status,
    t.options,
    COALESCE(
      (SELECT SUM((value->>'votes')::INTEGER)
       FROM jsonb_array_elements(t.options) AS value),
      0
    )::INTEGER AS total_votes,
    public.get_topic_exposure_score(t.id) AS exposure_score,
    t.exposure_level AS current_exposure_level,
    NULL::timestamptz AS exposure_expires_at
  FROM public.topics t
  WHERE t.status = 'active'
    AND t.is_hidden = false
    AND t.end_at >= now() - v_grace_interval
  ORDER BY
    CASE WHEN public.get_topic_exposure_score(t.id) > 0 THEN 0 ELSE 1 END,
    public.get_topic_exposure_score(t.id) DESC,
    COALESCE(
      (SELECT SUM((value->>'votes')::INTEGER)
       FROM jsonb_array_elements(t.options) AS value),
      0
    ) DESC,
    t.created_at DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- 3. 最新列表同樣使用 topics.exposure_level
CREATE OR REPLACE FUNCTION public.get_latest_topics_with_exposure(
  p_limit INTEGER DEFAULT 20,
  p_offset INTEGER DEFAULT 0
)
RETURNS TABLE (
  id UUID,
  title TEXT,
  description TEXT,
  tags TEXT[],
  creator_id UUID,
  exposure_level TEXT,
  duration_days INTEGER,
  created_at TIMESTAMPTZ,
  end_at TIMESTAMPTZ,
  status TEXT,
  options JSONB,
  total_votes INTEGER,
  current_exposure_level TEXT,
  exposure_expires_at TIMESTAMPTZ
) AS $$
DECLARE
  v_grace_days INTEGER := 3;
  v_grace_interval INTERVAL := INTERVAL '3 days';
BEGIN
  SELECT (value #>> '{}')::INTEGER
  INTO v_grace_days
  FROM public.system_config
  WHERE key = 'home_expired_topic_grace_days'
  LIMIT 1;

  IF v_grace_days IS NULL THEN
    v_grace_days := 3;
  END IF;

  v_grace_days := GREATEST(v_grace_days, 0);
  v_grace_interval := make_interval(days => v_grace_days);

  RETURN QUERY
  SELECT
    t.id,
    t.title,
    t.description,
    t.tags,
    t.creator_id,
    t.exposure_level,
    t.duration_days,
    t.created_at,
    t.end_at,
    t.status,
    t.options,
    vote_stats.total_votes::INTEGER AS total_votes,
    t.exposure_level AS current_exposure_level,
    NULL::timestamptz AS exposure_expires_at
  FROM public.topics t
  CROSS JOIN LATERAL (
    SELECT COALESCE(
      (SELECT SUM((value->>'votes')::INTEGER)
       FROM jsonb_array_elements(t.options) AS value),
      0
    ) AS total_votes
  ) AS vote_stats
  CROSS JOIN LATERAL (
    SELECT
      EXTRACT(EPOCH FROM t.created_at) AS created_epoch,
      CASE t.exposure_level
        WHEN 'high' THEN 7200    -- 2 小時
        WHEN 'medium' THEN 1800  -- 30 分鐘
        ELSE 0
      END AS exposure_offset,
      LEAST(vote_stats.total_votes, 20) * 60 AS interaction_offset,
      EXTRACT(EPOCH FROM t.created_at)
        + CASE t.exposure_level
            WHEN 'high' THEN 7200
            WHEN 'medium' THEN 1800
            ELSE 0
          END
        + LEAST(vote_stats.total_votes, 20) * 60 AS new_score
  ) AS score
  WHERE t.status = 'active'
    AND t.is_hidden = false
    AND t.end_at >= now() - v_grace_interval
  ORDER BY
    score.new_score DESC,
    t.created_at DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- 4. can_apply_exposure 僅允許低 -> 高，並計算差額
CREATE OR REPLACE FUNCTION public.can_apply_exposure(
  p_user_id UUID,
  p_exposure_level TEXT,
  p_topic_id UUID
)
RETURNS JSONB AS $$
DECLARE
  v_topic RECORD;
  v_limit RECORD;
  v_current_limit RECORD;
  v_current_rank INTEGER;
  v_target_rank INTEGER;
  v_price_diff INTEGER;
  v_violation_until TIMESTAMPTZ;
  v_user_stats RECORD;
  v_topic_votes INTEGER;
  v_active_target_count INTEGER;
  v_global_count INTEGER;
  v_global_limit_override INTEGER;
  v_global_limit_key TEXT;
  v_last_upgrade TIMESTAMPTZ;
BEGIN
  IF p_user_id IS NULL THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'not_authenticated');
  END IF;

  SELECT id, exposure_level, creator_id, status
  INTO v_topic
  FROM public.topics
  WHERE id = p_topic_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'topic_not_found');
  END IF;

  IF v_topic.creator_id <> p_user_id THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'not_topic_owner');
  END IF;

  SELECT * INTO v_limit
  FROM public.exposure_limits
  WHERE exposure_level = p_exposure_level;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'invalid_exposure_level');
  END IF;

  SELECT * INTO v_current_limit
  FROM public.exposure_limits
  WHERE exposure_level = v_topic.exposure_level;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'invalid_current_level');
  END IF;

  v_current_rank := CASE v_topic.exposure_level
    WHEN 'normal' THEN 1
    WHEN 'medium' THEN 2
    WHEN 'high' THEN 3
    ELSE 0
  END;

  v_target_rank := CASE p_exposure_level
    WHEN 'normal' THEN 1
    WHEN 'medium' THEN 2
    WHEN 'high' THEN 3
    ELSE 0
  END;

  IF v_target_rank <= v_current_rank THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'already_at_or_higher');
  END IF;

  v_price_diff := v_limit.price - v_current_limit.price;
  IF v_price_diff <= 0 THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'invalid_price_diff');
  END IF;

  SELECT MAX(penalty_until) INTO v_violation_until
  FROM public.exposure_violations
  WHERE user_id = p_user_id
    AND (penalty_until IS NULL OR penalty_until > now());

  IF v_violation_until IS NOT NULL THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'penalty_active', 'penalty_until', v_violation_until);
  END IF;

  SELECT * INTO v_user_stats
  FROM public.user_exposure_stats
  WHERE user_id = p_user_id
    AND exposure_level = p_exposure_level
    AND date = CURRENT_DATE;

  IF v_user_stats IS NOT NULL AND v_user_stats.application_count >= v_limit.daily_limit THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'daily_limit_exceeded', 'daily_limit', v_limit.daily_limit);
  END IF;

  SELECT COUNT(*) INTO v_active_target_count
  FROM public.topics
  WHERE creator_id = p_user_id
    AND status = 'active'
    AND exposure_level = p_exposure_level;

  IF v_active_target_count >= v_limit.max_concurrent THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'max_concurrent_exceeded', 'max_concurrent', v_limit.max_concurrent);
  END IF;

  SELECT COALESCE(
    (SELECT SUM((value->>'votes')::INTEGER)
     FROM jsonb_array_elements((SELECT options FROM public.topics WHERE id = p_topic_id)) AS value),
    0
  ) INTO v_topic_votes;

  IF v_topic_votes < v_limit.min_votes_required THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'reason', 'min_votes_not_met',
      'min_votes_required', v_limit.min_votes_required,
      'current_votes', v_topic_votes
    );
  END IF;

  IF v_limit.cooldown_hours > 0 THEN
    SELECT MAX(applied_at) INTO v_last_upgrade
    FROM public.exposure_applications
    WHERE user_id = p_user_id
      AND exposure_level = p_exposure_level
      AND applied_at > now() - (v_limit.cooldown_hours || ' hours')::INTERVAL;

    IF v_last_upgrade IS NOT NULL THEN
      RETURN jsonb_build_object(
        'allowed', false,
        'reason', 'cooldown_active',
        'cooldown_until', v_last_upgrade + (v_limit.cooldown_hours || ' hours')::INTERVAL,
        'cooldown_hours', v_limit.cooldown_hours
      );
    END IF;
  END IF;

  v_global_limit_key := CASE p_exposure_level
    WHEN 'normal' THEN 'home_exposure_global_limit_normal'
    WHEN 'medium' THEN 'home_exposure_global_limit_medium'
    WHEN 'high' THEN 'home_exposure_global_limit_high'
    ELSE NULL
  END;

  IF v_global_limit_key IS NOT NULL THEN
    SELECT (value #>> '{}')::INTEGER
    INTO v_global_limit_override
    FROM public.system_config
    WHERE key = v_global_limit_key
    LIMIT 1;
  END IF;

  IF v_global_limit_override IS NULL OR v_global_limit_override <= 0 THEN
    IF v_limit.daily_global_limit IS NOT NULL AND v_limit.daily_global_limit > 0 THEN
      v_global_limit_override := v_limit.daily_global_limit;
    ELSE
      v_global_limit_override := NULL;
    END IF;
  END IF;

  IF v_global_limit_override IS NOT NULL THEN
    SELECT COUNT(*) INTO v_global_count
    FROM public.exposure_applications
    WHERE exposure_level = p_exposure_level
      AND DATE(applied_at) = CURRENT_DATE;

    IF v_global_count >= v_global_limit_override THEN
      RETURN jsonb_build_object(
        'allowed', false,
        'reason', 'global_limit_exceeded',
        'global_limit', v_global_limit_override
      );
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'allowed', true,
    'price', v_price_diff,
    'current_level', v_topic.exposure_level
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. apply_exposure 直接更新 topics.exposure_level 並補差額
CREATE OR REPLACE FUNCTION public.apply_exposure(
  p_topic_id UUID,
  p_exposure_level TEXT
)
RETURNS JSONB AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_check_result JSONB;
  v_price_diff INTEGER;
  v_user_tokens INTEGER;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_authenticated');
  END IF;

  v_check_result := public.can_apply_exposure(v_user_id, p_exposure_level, p_topic_id);

  IF COALESCE((v_check_result->>'allowed')::BOOLEAN, false) = false THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', v_check_result->>'reason',
      'details', v_check_result
    );
  END IF;

  v_price_diff := COALESCE((v_check_result->>'price')::INTEGER, 0);

  SELECT tokens INTO v_user_tokens
  FROM public.profiles
  WHERE id = v_user_id;

  IF v_user_tokens < v_price_diff THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'insufficient_tokens',
      'required', v_price_diff,
      'current', v_user_tokens
    );
  END IF;

  UPDATE public.profiles
  SET tokens = tokens - v_price_diff
  WHERE id = v_user_id;

  UPDATE public.topics
  SET exposure_level = p_exposure_level,
      updated_at = now()
  WHERE id = p_topic_id;

  INSERT INTO public.exposure_applications (
    topic_id,
    user_id,
    exposure_level,
    price,
    status,
    expires_at
  ) VALUES (
    p_topic_id,
    v_user_id,
    p_exposure_level,
    v_price_diff,
    'expired',
    now()
  );

  INSERT INTO public.user_exposure_stats (
    user_id,
    exposure_level,
    date,
    application_count
  ) VALUES (
    v_user_id,
    p_exposure_level,
    CURRENT_DATE,
    1
  )
  ON CONFLICT (user_id, exposure_level, date)
  DO UPDATE SET
    application_count = public.user_exposure_stats.application_count + 1,
    updated_at = now();

  RETURN jsonb_build_object(
    'success', true,
    'new_level', p_exposure_level,
    'price', v_price_diff
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

