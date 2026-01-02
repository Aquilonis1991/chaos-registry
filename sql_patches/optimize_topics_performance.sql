-- PERFORMANCE OPTIMIZATION PATCH
-- 1. Add cached vote counts to topics table to avoid heavy JSON parsing
-- 2. Create index for Home Feed sorting
-- 3. Update Feed RPCs to use cached columns

BEGIN;

-- 1. Add materialized columns
ALTER TABLE public.topics
ADD COLUMN IF NOT EXISTS total_votes INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS token_votes_count INTEGER DEFAULT 0;

-- 2. Calculate initial values from existing JSON data (One-time migration)
-- Note: free_votes_count was added in previous patch
UPDATE public.topics
SET 
  total_votes = COALESCE((SELECT SUM((value->>'votes')::INTEGER) FROM jsonb_array_elements(options) AS value), 0),
  token_votes_count = COALESCE((SELECT SUM((value->>'votes')::INTEGER) FROM jsonb_array_elements(options) AS value), 0) - COALESCE(free_votes_count, 0);

-- 3. Create Composite Index for Home Feed
-- Most frequent query: status='active', is_hidden=false, end_at > now, sorted by...
CREATE INDEX IF NOT EXISTS idx_topics_feed_performance 
ON public.topics (status, is_hidden, end_at, created_at DESC)
INCLUDE (title, total_votes, exposure_level);

-- 4. Create Trigger to maintain total_votes automaticaly
-- Instead of modifying every RPC, we use a trigger that updates 'total_votes' whenever 'options' changes.
CREATE OR REPLACE FUNCTION public.sync_topic_vote_counts()
RETURNS TRIGGER AS $$
DECLARE
  v_new_total INTEGER;
BEGIN
  -- Re-calculate total from the new options JSON
  SELECT COALESCE(SUM((value->>'votes')::INTEGER), 0)
  INTO v_new_total
  FROM jsonb_array_elements(NEW.options) AS value;
  
  -- Update the cached columns
  NEW.total_votes := v_new_total;
  NEW.token_votes_count := v_new_total - COALESCE(NEW.free_votes_count, 0);
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_sync_vote_counts ON public.topics;
CREATE TRIGGER trigger_sync_vote_counts
BEFORE INSERT OR UPDATE OF options ON public.topics
FOR EACH ROW
EXECUTE FUNCTION public.sync_topic_vote_counts();


-- 5. Optimized RPC: get_hot_topics_with_exposure (V2)
-- Uses the new total_votes column instead of parsing JSON
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
  v_grace_interval INTERVAL;
BEGIN
  -- Grace days logic
  IF p_grace_days IS NOT NULL THEN
     v_grace_days := p_grace_days;
  ELSE
    SELECT (value #>> '{}')::INTEGER INTO v_grace_days
    FROM public.system_config WHERE key = 'home_expired_topic_grace_days' LIMIT 1;
    v_grace_days := COALESCE(v_grace_days, 3);
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
    t.total_votes, -- DIRECLY FROM COLUMN
    public.get_topic_exposure_score(t.id) AS exposure_score,
    t.exposure_level AS current_exposure_level,
    NULL::timestamptz AS exposure_expires_at
  FROM public.topics t
  WHERE t.status = 'active'
    AND t.is_hidden = false
    AND t.end_at >= now() - v_grace_interval
  ORDER BY
    -- Note: exposure_score still calls a function, for ultimate performance we should cache this too, but total_votes is the big win here.
    CASE WHEN public.get_topic_exposure_score(t.id) > 0 THEN 0 ELSE 1 END,
    public.get_topic_exposure_score(t.id) DESC,
    t.total_votes DESC, -- INDEX FRIENDLY
    t.created_at DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- 6. Optimized RPC: get_latest_topics_with_exposure (V2)
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
  v_grace_interval INTERVAL;
BEGIN
  -- Grace days logic...
  IF p_grace_days IS NOT NULL THEN
     v_grace_days := p_grace_days;
  ELSE
    SELECT (value #>> '{}')::INTEGER INTO v_grace_days
    FROM public.system_config WHERE key = 'home_expired_topic_grace_days' LIMIT 1;
    v_grace_days := COALESCE(v_grace_days, 3);
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
    t.total_votes, -- DIRECTLY FROM COLUMN
    t.exposure_level AS current_exposure_level,
    NULL::timestamptz AS exposure_expires_at
  FROM public.topics t
  -- REMOVED CROSS JOIN LATERAL
  CROSS JOIN LATERAL (
    SELECT
      EXTRACT(EPOCH FROM t.created_at) AS created_epoch,
      LEAST(t.total_votes, 20) * 60 AS interaction_offset,
      EXTRACT(EPOCH FROM t.created_at)
        + CASE t.exposure_level
            WHEN 'high' THEN 7200
            WHEN 'medium' THEN 1800
            ELSE 0
          END
        + LEAST(t.total_votes, 20) * 60 AS new_score
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

COMMIT;
