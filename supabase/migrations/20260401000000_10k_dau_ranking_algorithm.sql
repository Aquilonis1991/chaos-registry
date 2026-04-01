-- ========================================
-- 10,000 DAU 承受力熱門排序與曝光修復
-- ========================================

-- 1. 全新指數衰減與防通膨曝光計分系統 (Hacker News Gravity Model)
CREATE OR REPLACE FUNCTION public.get_topic_exposure_score(p_topic_id UUID)
RETURNS NUMERIC AS $$
DECLARE
  v_exposure_level TEXT;
  v_vote_count INTEGER;
  v_created_at TIMESTAMPTZ;
  v_hours_since_creation NUMERIC;
  v_organic_score NUMERIC;
  v_gravity NUMERIC;
  v_base_score NUMERIC;
  v_boost NUMERIC := 0;
BEGIN
  -- 1) 正確檢查「未過期」且「狀態活躍」的最高級曝光申請
  SELECT ea.exposure_level INTO v_exposure_level
  FROM public.exposure_applications ea
  WHERE ea.topic_id = p_topic_id
    AND ea.status = 'active'
    AND ea.expires_at > now()
  ORDER BY 
    CASE ea.exposure_level
      WHEN 'high' THEN 3
      WHEN 'medium' THEN 2
      WHEN 'normal' THEN 1
      ELSE 0
    END DESC,
    ea.applied_at ASC
  LIMIT 1;
  
  -- 2) 獲取總票數
  SELECT COALESCE(
    (SELECT SUM((value->>'votes')::INTEGER)
     FROM jsonb_array_elements((SELECT options FROM public.topics WHERE id = p_topic_id)) AS value),
    0
  ) INTO v_vote_count;
  
  -- 3) 獲取創建時間
  SELECT created_at INTO v_created_at
  FROM public.topics
  WHERE id = p_topic_id;
  
  -- 4) 時間衰減模型 (Gravity) : (hours + 2)^1.5
  v_hours_since_creation := GREATEST(EXTRACT(EPOCH FROM (now() - COALESCE(v_created_at, now()))) / 3600.0, 0);
  v_gravity := POWER(v_hours_since_creation + 2.0, 1.5);
  
  -- 5) 有機熱度防通膨模型 (Anti-Inflation) : POWER(votes, 0.8) * 10
  v_organic_score := POWER(GREATEST(v_vote_count, 0), 0.8) * 10.0;
  
  -- 計算基礎有機分數
  v_base_score := v_organic_score / v_gravity;
  
  -- 6) 付費特權加權 (Absolute Boost)
  IF v_exposure_level = 'high' THEN
    v_boost := 500.0;
  ELSIF v_exposure_level = 'medium' THEN
    v_boost := 200.0;
  ELSIF v_exposure_level = 'normal' THEN
    v_boost := 50.0;
  END IF;

  RETURN v_base_score + v_boost;
END;
$$ LANGUAGE plpgsql STABLE;


-- 2. 修改 get_hot_topics_with_exposure 不再使用 CASE WHEN，並修復無限期問題
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
  IF p_grace_days IS NOT NULL THEN
     v_grace_days := p_grace_days;
  ELSE
    SELECT (value #>> '{}')::INTEGER INTO v_grace_days
    FROM public.system_config WHERE key = 'home_expired_topic_grace_days' LIMIT 1;
    IF v_grace_days IS NULL THEN v_grace_days := 3; END IF;
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
    t.exposure_level, -- 歷史最高等級或預設級別（保密不影響首頁動態行為）
    t.duration_days,
    t.created_at, 
    t.end_at, 
    t.status, 
    t.options,
    COALESCE(
      (SELECT SUM((value->>'votes')::INTEGER) FROM jsonb_array_elements(t.options) AS value),
      0
    )::INTEGER AS total_votes,
    public.get_topic_exposure_score(t.id) AS exposure_score,
    -- 即時推算當前有效曝光等級
    (SELECT ea.exposure_level
     FROM public.exposure_applications ea
     WHERE ea.topic_id = t.id
       AND ea.status = 'active'
       AND ea.expires_at > now()
     ORDER BY 
       CASE ea.exposure_level WHEN 'high' THEN 3 WHEN 'medium' THEN 2 WHEN 'normal' THEN 1 ELSE 0 END DESC,
       ea.applied_at ASC
     LIMIT 1) AS current_exposure_level,
    -- 即時推算曝光到期時間
    (SELECT ea.expires_at
     FROM public.exposure_applications ea
     WHERE ea.topic_id = t.id
       AND ea.status = 'active'
       AND ea.expires_at > now()
     ORDER BY 
       CASE ea.exposure_level WHEN 'high' THEN 3 WHEN 'medium' THEN 2 WHEN 'normal' THEN 1 ELSE 0 END DESC,
       ea.applied_at ASC
     LIMIT 1) AS exposure_expires_at
  FROM public.topics t
  WHERE t.is_hidden = false
    AND t.end_at >= now() - v_grace_interval
    AND t.status IN ('active', 'ended')
  ORDER BY
    -- 因為大約 10~50 的 base score 絕對敵不過 200/500 的曝光 boost，所以可以直接一個 exposure_score 遞減排序。
    public.get_topic_exposure_score(t.id) DESC,
    COALESCE(
      (SELECT SUM((value->>'votes')::INTEGER) FROM jsonb_array_elements(t.options) AS value),
      0
    ) DESC,
    t.created_at DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public;


-- 3. 修改 get_latest_topics_with_exposure 不再盲目延續 Topics.exposure_level
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
  IF p_grace_days IS NOT NULL THEN
     v_grace_days := p_grace_days;
  ELSE
    SELECT (value #>> '{}')::INTEGER INTO v_grace_days
    FROM public.system_config WHERE key = 'home_expired_topic_grace_days' LIMIT 1;
    IF v_grace_days IS NULL THEN v_grace_days := 3; END IF;
  END IF;
  v_grace_days := GREATEST(v_grace_days, 0);
  v_grace_interval := make_interval(days => v_grace_days);

  RETURN QUERY
  SELECT
    t.id, t.title, t.description, t.tags, t.creator_id, t.exposure_level, t.duration_days,
    t.created_at, t.end_at, t.status, t.options,
    vote_stats.total_votes::INTEGER AS total_votes,
    (SELECT ea.exposure_level FROM public.exposure_applications ea WHERE ea.topic_id = t.id AND ea.status = 'active' AND ea.expires_at > now() ORDER BY CASE ea.exposure_level WHEN 'high' THEN 3 WHEN 'medium' THEN 2 WHEN 'normal' THEN 1 ELSE 0 END DESC LIMIT 1) AS current_exposure_level,
    (SELECT ea.expires_at FROM public.exposure_applications ea WHERE ea.topic_id = t.id AND ea.status = 'active' AND ea.expires_at > now() ORDER BY CASE ea.exposure_level WHEN 'high' THEN 3 WHEN 'medium' THEN 2 WHEN 'normal' THEN 1 ELSE 0 END DESC LIMIT 1) AS exposure_expires_at
  FROM public.topics t
  CROSS JOIN LATERAL (
    SELECT COALESCE(
      (SELECT SUM((value->>'votes')::INTEGER) FROM jsonb_array_elements(t.options) AS value),
      0
    ) AS total_votes
  ) AS vote_stats
  CROSS JOIN LATERAL (
    SELECT
      EXTRACT(EPOCH FROM t.created_at) AS created_epoch,
      -- 取最新的 active 等級
      COALESCE((SELECT 
        CASE ea.exposure_level WHEN 'high' THEN 7200 WHEN 'medium' THEN 1800 ELSE 600 END
        FROM public.exposure_applications ea WHERE ea.topic_id = t.id AND ea.status = 'active' AND ea.expires_at > now() ORDER BY CASE ea.exposure_level WHEN 'high' THEN 3 WHEN 'medium' THEN 2 ELSE 1 END DESC LIMIT 1
      ), 0) AS exposure_offset,
      LEAST(vote_stats.total_votes, 20) * 60 AS interaction_offset
  ) AS score_vars
  WHERE t.is_hidden = false
    AND t.end_at >= now() - v_grace_interval
    AND t.status IN ('active', 'ended')
  ORDER BY 
    (score_vars.created_epoch + score_vars.exposure_offset + score_vars.interaction_offset) DESC, 
    t.created_at DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public;
