-- =================================================================
-- PERFORMANCE OPTIMIZATION PATCH (2026-01-16)
-- 
-- 1. Add Composite Indexes for high-frequency queries
-- 2. Optimize Topic Listing RPCs (Remove JSON parsing)
-- 3. Optimize Free Vote Check (Use Index-friendly Date Range)
-- =================================================================

BEGIN;

-- -----------------------------------------------------------------
-- 1. INDEX OPTIMIZATION
-- -----------------------------------------------------------------

-- Optimizes: checkFreeVoteAvailable & increment_free_vote
CREATE INDEX IF NOT EXISTS idx_free_votes_check 
ON public.free_votes (user_id, topic_id, used_at);

-- Optimizes: useTokenHistory (prevent scan on millions of rows)
CREATE INDEX IF NOT EXISTS idx_token_txn_user_date 
ON public.token_transactions (user_id, created_at DESC);

-- Optimizes: has_voted checks
CREATE INDEX IF NOT EXISTS idx_votes_user_topic 
ON public.votes (user_id, topic_id);


-- -----------------------------------------------------------------
-- 2. FUNCTION OPTIMIZATION: HOT TOPICS
-- -----------------------------------------------------------------

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
    -- [OPTIMIZED] Use materialized column directly instead of parsing JSON
    t.total_votes,
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
    -- [OPTIMIZED] Use column for sorting
    t.total_votes DESC,
    t.created_at DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;


-- -----------------------------------------------------------------
-- 3. FUNCTION OPTIMIZATION: LATEST TOPICS
-- -----------------------------------------------------------------

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
    -- [OPTIMIZED] Use materialized column
    t.total_votes,
    t.exposure_level AS current_exposure_level,
    NULL::timestamptz AS exposure_expires_at
  FROM public.topics t
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
      -- [OPTIMIZED] Use column for calculation
      LEAST(t.total_votes, 20) * 60 AS interaction_offset,
      
      -- New Score for sorting (Virtual Time)
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


-- -----------------------------------------------------------------
-- 4. FUNCTION OPTIMIZATION: FREE VOTE INCREMENT
-- -----------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.increment_free_vote(
  p_topic_id UUID,
  p_option_id TEXT
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_topic_record RECORD;
  v_option_index INTEGER;
  v_updated_options JSONB;
  v_already_used BOOLEAN;
  v_topic_title TEXT;
  v_option_label TEXT;
BEGIN
  v_user_id := auth.uid();

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'User must be authenticated';
  END IF;

  -- 檢查今日是否已使用免費票 (OPTIMIZED: Range Query for Index Usage)
  SELECT EXISTS(
    SELECT 1
    FROM public.free_votes
    WHERE user_id = v_user_id
      AND topic_id = p_topic_id
      AND used_at >= CURRENT_DATE
      AND used_at < CURRENT_DATE + INTERVAL '1 day'
  ) INTO v_already_used;

  IF v_already_used THEN
    RAISE EXCEPTION 'Free vote already used today for this topic';
  END IF;

  -- 讀取主題資料
  SELECT * INTO v_topic_record
  FROM public.topics
  WHERE id = p_topic_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Topic not found';
  END IF;

  -- 保存主題標題用於記錄
  v_topic_title := v_topic_record.title;

  IF v_topic_record.status != 'active' THEN
    RAISE EXCEPTION 'Topic is not active';
  END IF;

  IF v_topic_record.end_at < NOW() THEN
    RAISE EXCEPTION 'Topic has ended';
  END IF;

  -- 檢查選項是否存在並獲取選項文字
  v_option_index := -1;
  v_option_label := 'Unknown';
  
  FOR i IN 0..jsonb_array_length(v_topic_record.options) - 1 LOOP
    IF (v_topic_record.options->i->>'id') = p_option_id THEN
      v_option_index := i;
      v_option_label := v_topic_record.options->i->>'label'; -- 獲取選項顯示文字
      EXIT;
    END IF;
  END LOOP;

  IF v_option_index = -1 THEN
    RAISE EXCEPTION 'Option not found';
  END IF;

  -- 更新選項票數
  v_updated_options := jsonb_set(
    v_topic_record.options,
    ARRAY[v_option_index::text, 'votes'],
    to_jsonb((COALESCE((v_topic_record.options->v_option_index->>'votes')::INTEGER, 0) + 1))
  );

  -- 更新主題 (包含 free_votes_count 和 total_votes)
  -- 注意：假設 trigger 會處理 topic.total_votes, 但我們也可以在這裡明確更新以防萬一
  UPDATE public.topics
  SET 
    options = v_updated_options,
    free_votes_count = COALESCE(free_votes_count, 0) + 1 
    -- total_votes 未在此處更新，依賴 trigger 'sync_topic_vote_counts'
  WHERE id = p_topic_id;

  -- 記錄免費票
  INSERT INTO public.free_votes (user_id, topic_id, option, used_at)
  VALUES (v_user_id, p_topic_id, p_option_id, NOW());
  
  -- 添加到主題參與者 (如果尚未存在)
  INSERT INTO public.topic_participants (user_id, topic_id)
  VALUES (v_user_id, p_topic_id)
  ON CONFLICT (user_id, topic_id) DO NOTHING;

END;
$$;

NOTIFY pgrst, 'reload schema';

COMMIT;
