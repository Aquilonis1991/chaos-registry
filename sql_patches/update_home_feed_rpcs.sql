-- ========================================
-- Update Home Feed RPCs to accept Grace Days
-- ========================================

-- 1. Update get_hot_topics_with_exposure to accept p_grace_days
CREATE OR REPLACE FUNCTION public.get_hot_topics_with_exposure(
  p_limit INTEGER DEFAULT 20,
  p_offset INTEGER DEFAULT 0,
  p_grace_days INTEGER DEFAULT NULL
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
  -- If p_grace_days is provided (not null), use it. Otherwise, fetch from system_config.
  IF p_grace_days IS NOT NULL THEN
     v_grace_days := p_grace_days;
  ELSE
    SELECT (value #>> '{}')::INTEGER
    INTO v_grace_days
    FROM public.system_config
    WHERE key = 'home_expired_topic_grace_days'
    LIMIT 1;

    IF v_grace_days IS NULL THEN
      v_grace_days := 3;
    END IF;
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

-- 2. Update get_latest_topics_with_exposure to accept p_grace_days
CREATE OR REPLACE FUNCTION public.get_latest_topics_with_exposure(
  p_limit INTEGER DEFAULT 20,
  p_offset INTEGER DEFAULT 0,
  p_grace_days INTEGER DEFAULT NULL
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
  -- If p_grace_days is provided (not null), use it. Otherwise, fetch from system_config.
  IF p_grace_days IS NOT NULL THEN
     v_grace_days := p_grace_days;
  ELSE
    SELECT (value #>> '{}')::INTEGER
    INTO v_grace_days
    FROM public.system_config
    WHERE key = 'home_expired_topic_grace_days'
    LIMIT 1;

    IF v_grace_days IS NULL THEN
      v_grace_days := 3;
    END IF;
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
