-- =================================================================
-- REWRITE EXPOSURE LOGIC (CORRECTED)
-- 
-- High Exposure (高等曝光) -> Pinned & Priority Recommendation (置頂與優先推薦)
-- Medium Exposure (中度曝光) -> Priority Display (優先顯示)
-- =================================================================

-- 1. Hot Topics (熱門): 
-- Logic: High (Pinned Top) > Medium (Priority) > Normal
-- Secondary Sort: Exposure Score > Votes > Created At
CREATE OR REPLACE FUNCTION public.get_hot_topics_with_exposure(
  p_limit INTEGER DEFAULT 20,
  p_offset INTEGER DEFAULT 0,
  p_grace_days INTEGER DEFAULT 3
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
  v_grace_interval INTERVAL;
BEGIN
  -- Handle grace period default
  p_grace_days := GREATEST(COALESCE(p_grace_days, 3), 0);
  v_grace_interval := make_interval(days => p_grace_days);

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
    -- Tier 1: High (Pinned) - Absolute Top
    CASE 
      WHEN t.exposure_level = 'high' THEN 0 
      WHEN t.exposure_level = 'medium' THEN 1
      ELSE 2 
    END ASC,
    -- Tier 2: Score based sorting within tiers
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


-- 2. Latest Topics (最新):
-- Logic: High (Pinned Top) > Medium (Priority) > Normal (Real Time)
-- High gets pinned. Medium gets priority tier over Normal.
CREATE OR REPLACE FUNCTION public.get_latest_topics_with_exposure(
  p_limit INTEGER DEFAULT 20,
  p_offset INTEGER DEFAULT 0,
  p_grace_days INTEGER DEFAULT 3
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
  v_grace_interval INTERVAL;
BEGIN
  -- Handle grace period default
  p_grace_days := GREATEST(COALESCE(p_grace_days, 3), 0);
  v_grace_interval := make_interval(days => p_grace_days);

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
        -- High Exposure: Boost 2 hours + Interaction Boost (Priority Display)
        WHEN 'high' THEN 7200
        -- Medium Exposure: Boost 30 mins
        WHEN 'medium' THEN 1800
        ELSE 0
      END AS exposure_offset,
      LEAST(vote_stats.total_votes, 20) * 60 AS interaction_offset,
      
      -- New Score for sorting (Virtual Time)
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
    -- Tier 1: High (Pinned Top)
    CASE 
      WHEN t.exposure_level = 'high' THEN 0 
      WHEN t.exposure_level = 'medium' THEN 1
      ELSE 2 
    END ASC,
    -- Tier 2: Virtual Time Sorting within tiers
    score.new_score DESC,
    t.created_at DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;
