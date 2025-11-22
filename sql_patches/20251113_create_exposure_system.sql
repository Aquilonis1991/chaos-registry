-- ========================================
-- 曝光系統完整實現
-- ========================================

-- 1. 創建曝光申請表
CREATE TABLE IF NOT EXISTS public.exposure_applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  topic_id UUID NOT NULL REFERENCES public.topics(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  exposure_level TEXT NOT NULL CHECK (exposure_level IN ('normal', 'medium', 'high')),
  price INTEGER NOT NULL, -- 價格（代幣數）
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'expired', 'cancelled')),
  applied_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL, -- 曝光結束時間
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(topic_id, user_id, status) -- 同一主題同一用戶只能有一個活躍曝光
);

-- 創建索引
CREATE INDEX IF NOT EXISTS idx_exposure_applications_topic_id ON public.exposure_applications(topic_id);
CREATE INDEX IF NOT EXISTS idx_exposure_applications_user_id ON public.exposure_applications(user_id);
CREATE INDEX IF NOT EXISTS idx_exposure_applications_status ON public.exposure_applications(status);
CREATE INDEX IF NOT EXISTS idx_exposure_applications_expires_at ON public.exposure_applications(expires_at);
CREATE INDEX IF NOT EXISTS idx_exposure_applications_applied_at ON public.exposure_applications(applied_at);

-- 啟用 RLS
ALTER TABLE public.exposure_applications ENABLE ROW LEVEL SECURITY;

-- RLS 政策
DROP POLICY IF EXISTS "Users can view all exposure applications" ON public.exposure_applications;
CREATE POLICY "Users can view all exposure applications"
  ON public.exposure_applications FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Users can create own exposure applications" ON public.exposure_applications;
CREATE POLICY "Users can create own exposure applications"
  ON public.exposure_applications FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own exposure applications" ON public.exposure_applications;
CREATE POLICY "Users can update own exposure applications"
  ON public.exposure_applications FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

-- 2. 創建曝光限制配置表（用於系統管理）
CREATE TABLE IF NOT EXISTS public.exposure_limits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  exposure_level TEXT NOT NULL UNIQUE CHECK (exposure_level IN ('normal', 'medium', 'high')),
  daily_limit INTEGER NOT NULL DEFAULT 0, -- 每日申請上限
  daily_global_limit INTEGER NOT NULL DEFAULT 0, -- 全平台每日曝光名額限制
  max_concurrent INTEGER NOT NULL DEFAULT 2, -- 同時最多曝光主題數
  min_votes_required INTEGER NOT NULL DEFAULT 20, -- 最低投票門檻
  cooldown_hours INTEGER NOT NULL DEFAULT 0, -- 冷卻時間（小時）
  price INTEGER NOT NULL DEFAULT 0, -- 價格（代幣數）
  sort_weight_multiplier NUMERIC(5,2) NOT NULL DEFAULT 1.0, -- 排序權重倍數
  top_duration_minutes INTEGER NOT NULL DEFAULT 0, -- 熱門榜置頂時間（分鐘）
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 初始化曝光限制配置
INSERT INTO public.exposure_limits (exposure_level, daily_limit, daily_global_limit, max_concurrent, min_votes_required, cooldown_hours, price, sort_weight_multiplier, top_duration_minutes)
VALUES 
  ('normal', 5, 500, 2, 20, 0, 30, 1.2, 30),
  ('medium', 3, 300, 2, 20, 0, 90, 1.6, 60),
  ('high', 1, 100, 2, 20, 12, 180, 2.2, 120)
ON CONFLICT (exposure_level) DO NOTHING;

-- 3. 創建用戶曝光統計表（用於追蹤每日申請次數）
CREATE TABLE IF NOT EXISTS public.user_exposure_stats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  exposure_level TEXT NOT NULL CHECK (exposure_level IN ('normal', 'medium', 'high')),
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  application_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, exposure_level, date)
);

CREATE INDEX IF NOT EXISTS idx_user_exposure_stats_user_date ON public.user_exposure_stats(user_id, date);

-- 4. 創建曝光違規記錄表（用於追蹤洗榜行為）
CREATE TABLE IF NOT EXISTS public.exposure_violations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  topic_id UUID REFERENCES public.topics(id) ON DELETE SET NULL,
  violation_type TEXT NOT NULL CHECK (violation_type IN ('low_votes', 'spam', 'other')),
  violation_reason TEXT,
  penalty_until TIMESTAMPTZ, -- 處罰結束時間
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_exposure_violations_user_id ON public.exposure_violations(user_id);
CREATE INDEX IF NOT EXISTS idx_exposure_violations_penalty_until ON public.exposure_violations(penalty_until);

-- 5. 創建更新 updated_at 的觸發器
CREATE OR REPLACE FUNCTION public.update_exposure_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_exposure_applications_updated_at ON public.exposure_applications;
CREATE TRIGGER update_exposure_applications_updated_at
  BEFORE UPDATE ON public.exposure_applications
  FOR EACH ROW EXECUTE FUNCTION public.update_exposure_updated_at();

DROP TRIGGER IF EXISTS update_exposure_limits_updated_at ON public.exposure_limits;
CREATE TRIGGER update_exposure_limits_updated_at
  BEFORE UPDATE ON public.exposure_limits
  FOR EACH ROW EXECUTE FUNCTION public.update_exposure_updated_at();

DROP TRIGGER IF EXISTS update_user_exposure_stats_updated_at ON public.user_exposure_stats;
CREATE TRIGGER update_user_exposure_stats_updated_at
  BEFORE UPDATE ON public.user_exposure_stats
  FOR EACH ROW EXECUTE FUNCTION public.update_exposure_updated_at();

-- 6. 自動過期曝光申請的函數
CREATE OR REPLACE FUNCTION public.expire_old_exposure_applications()
RETURNS INTEGER AS $$
DECLARE
  expired_count INTEGER;
BEGIN
  UPDATE public.exposure_applications
  SET status = 'expired', updated_at = now()
  WHERE status = 'active' 
    AND expires_at < now();
  
  GET DIAGNOSTICS expired_count = ROW_COUNT;
  RETURN expired_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 7. 獲取曝光等級權重的函數
CREATE OR REPLACE FUNCTION public.get_exposure_weight(p_exposure_level TEXT)
RETURNS NUMERIC AS $$
DECLARE
  v_weight NUMERIC;
BEGIN
  SELECT sort_weight_multiplier INTO v_weight
  FROM public.exposure_limits
  WHERE exposure_level = p_exposure_level;
  
  RETURN COALESCE(v_weight, 1.0);
END;
$$ LANGUAGE plpgsql STABLE;

-- 8. 檢查用戶是否可以申請曝光的函數
CREATE OR REPLACE FUNCTION public.can_apply_exposure(
  p_user_id UUID,
  p_exposure_level TEXT,
  p_topic_id UUID
)
RETURNS JSONB AS $$
DECLARE
  v_limit RECORD;
  v_user_stats RECORD;
  v_active_count INTEGER;
  v_topic_votes INTEGER;
  v_violation_until TIMESTAMPTZ;
  v_result JSONB;
BEGIN
  -- 獲取曝光限制配置
  SELECT * INTO v_limit
  FROM public.exposure_limits
  WHERE exposure_level = p_exposure_level;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'reason', 'invalid_exposure_level'
    );
  END IF;
  
  -- 檢查是否在處罰期間
  SELECT MAX(penalty_until) INTO v_violation_until
  FROM public.exposure_violations
  WHERE user_id = p_user_id
    AND (penalty_until IS NULL OR penalty_until > now());
  
  IF v_violation_until IS NOT NULL AND v_violation_until > now() THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'reason', 'penalty_active',
      'penalty_until', v_violation_until
    );
  END IF;
  
  -- 檢查今日申請次數
  SELECT * INTO v_user_stats
  FROM public.user_exposure_stats
  WHERE user_id = p_user_id
    AND exposure_level = p_exposure_level
    AND date = CURRENT_DATE;
  
  IF v_user_stats IS NOT NULL AND v_user_stats.application_count >= v_limit.daily_limit THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'reason', 'daily_limit_exceeded',
      'daily_limit', v_limit.daily_limit
    );
  END IF;
  
  -- 檢查同時曝光主題數
  SELECT COUNT(*) INTO v_active_count
  FROM public.exposure_applications
  WHERE user_id = p_user_id
    AND status = 'active'
    AND expires_at > now();
  
  IF v_active_count >= v_limit.max_concurrent THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'reason', 'max_concurrent_exceeded',
      'max_concurrent', v_limit.max_concurrent
    );
  END IF;
  
  -- 檢查主題投票數
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
  
  -- 檢查冷卻時間
  IF v_limit.cooldown_hours > 0 THEN
    DECLARE
      v_last_application TIMESTAMPTZ;
    BEGIN
      SELECT MAX(applied_at) INTO v_last_application
      FROM public.exposure_applications
      WHERE user_id = p_user_id
        AND exposure_level = p_exposure_level
        AND status IN ('expired', 'cancelled')
        AND applied_at > now() - (v_limit.cooldown_hours || ' hours')::INTERVAL;
      
      IF v_last_application IS NOT NULL THEN
        RETURN jsonb_build_object(
          'allowed', false,
          'reason', 'cooldown_active',
          'cooldown_until', v_last_application + (v_limit.cooldown_hours || ' hours')::INTERVAL,
          'cooldown_hours', v_limit.cooldown_hours
        );
      END IF;
    END;
  END IF;
  
  -- 檢查全平台每日名額
  DECLARE
    v_global_count INTEGER;
  BEGIN
    SELECT COUNT(*) INTO v_global_count
    FROM public.exposure_applications
    WHERE exposure_level = p_exposure_level
      AND status = 'active'
      AND DATE(applied_at) = CURRENT_DATE;
    
    IF v_global_count >= v_limit.daily_global_limit THEN
      RETURN jsonb_build_object(
        'allowed', false,
        'reason', 'global_limit_exceeded',
        'global_limit', v_limit.daily_global_limit
      );
    END IF;
  END;
  
  -- 所有檢查通過
  RETURN jsonb_build_object(
    'allowed', true,
    'price', v_limit.price
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 9. 申請曝光的函數
CREATE OR REPLACE FUNCTION public.apply_exposure(
  p_topic_id UUID,
  p_exposure_level TEXT
)
RETURNS JSONB AS $$
DECLARE
  v_user_id UUID;
  v_check_result JSONB;
  v_limit RECORD;
  v_user_tokens INTEGER;
  v_duration_minutes INTEGER;
  v_expires_at TIMESTAMPTZ;
  v_application_id UUID;
BEGIN
  -- 獲取當前用戶ID
  v_user_id := auth.uid();
  
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'not_authenticated'
    );
  END IF;
  
  -- 檢查是否可以申請
  v_check_result := public.can_apply_exposure(v_user_id, p_exposure_level, p_topic_id);
  
  IF (v_check_result->>'allowed')::BOOLEAN = false THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', v_check_result->>'reason',
      'details', v_check_result
    );
  END IF;
  
  -- 獲取限制配置
  SELECT * INTO v_limit
  FROM public.exposure_limits
  WHERE exposure_level = p_exposure_level;
  
  -- 檢查用戶代幣餘額
  SELECT tokens INTO v_user_tokens
  FROM public.profiles
  WHERE id = v_user_id;
  
  IF v_user_tokens < (v_check_result->>'price')::INTEGER THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'insufficient_tokens',
      'required', (v_check_result->>'price')::INTEGER,
      'current', v_user_tokens
    );
  END IF;
  
  -- 計算過期時間
  v_duration_minutes := v_limit.top_duration_minutes;
  v_expires_at := now() + (v_duration_minutes || ' minutes')::INTERVAL;
  
  -- 扣除代幣
  UPDATE public.profiles
  SET tokens = tokens - (v_check_result->>'price')::INTEGER
  WHERE id = v_user_id;
  
  -- 創建曝光申請
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
    (v_check_result->>'price')::INTEGER,
    'active',
    v_expires_at
  )
  RETURNING id INTO v_application_id;
  
  -- 更新用戶統計
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
    application_count = user_exposure_stats.application_count + 1,
    updated_at = now();
  
  RETURN jsonb_build_object(
    'success', true,
    'application_id', v_application_id,
    'expires_at', v_expires_at
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 10. 獲取主題曝光分數的函數（用於排序）
CREATE OR REPLACE FUNCTION public.get_topic_exposure_score(p_topic_id UUID)
RETURNS NUMERIC AS $$
DECLARE
  v_exposure_level TEXT;
  v_weight NUMERIC;
  v_vote_count INTEGER;
  v_created_at TIMESTAMPTZ;
  v_hours_since_creation NUMERIC;
  v_base_popularity NUMERIC;
  v_exposure_score NUMERIC;
BEGIN
  -- 獲取主題的曝光等級（從活躍的曝光申請）
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
    ea.applied_at ASC -- 付款時間優先
  LIMIT 1;
  
  -- 如果沒有活躍曝光，返回基礎分數
  IF v_exposure_level IS NULL THEN
    RETURN 0;
  END IF;
  
  -- 獲取權重
  v_weight := public.get_exposure_weight(v_exposure_level);
  
  -- 獲取投票數
  SELECT COALESCE(
    (SELECT SUM((value->>'votes')::INTEGER)
     FROM jsonb_array_elements((SELECT options FROM public.topics WHERE id = p_topic_id)) AS value),
    0
  ) INTO v_vote_count;
  
  -- 獲取創建時間
  SELECT created_at INTO v_created_at
  FROM public.topics
  WHERE id = p_topic_id;
  
  -- 計算時間衰減（小時）
  v_hours_since_creation := EXTRACT(EPOCH FROM (now() - v_created_at)) / 3600;
  
  -- 計算基礎熱門度（投票數的對數，避免過大差異）
  v_base_popularity := LOG(GREATEST(v_vote_count, 1) + 1);
  
  -- 計算曝光分數
  -- exposure_score = (base_popularity × 0.5) + (vote_count × 0.3) + (exposure_level_weight × 0.2) − (time_decay_hours × 0.02)
  v_exposure_score := 
    (v_base_popularity * 0.5) +
    (v_vote_count * 0.3) +
    (v_weight * 100 * 0.2) - -- 權重放大100倍以便計算
    (v_hours_since_creation * 0.02);
  
  RETURN v_exposure_score;
END;
$$ LANGUAGE plpgsql STABLE;

-- 11. 獲取熱門主題列表（含曝光排序）
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
BEGIN
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
    (SELECT ea.exposure_level
     FROM public.exposure_applications ea
     WHERE ea.topic_id = t.id
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
     LIMIT 1) AS current_exposure_level,
    (SELECT ea.expires_at
     FROM public.exposure_applications ea
     WHERE ea.topic_id = t.id
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
     LIMIT 1) AS exposure_expires_at
  FROM public.topics t
  WHERE t.status = 'active'
    AND t.is_hidden = false
    AND t.end_at > now()
  ORDER BY 
    -- 優先顯示有曝光的（推廣主題區）
    CASE 
      WHEN public.get_topic_exposure_score(t.id) > 0 THEN 0
      ELSE 1
    END,
    -- 然後按曝光分數排序
    public.get_topic_exposure_score(t.id) DESC,
    -- 最後按投票數和時間排序
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

-- 12. 獲取最新主題列表（含曝光插隊）
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
BEGIN
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
    (SELECT ea.exposure_level
     FROM public.exposure_applications ea
     WHERE ea.topic_id = t.id
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
     LIMIT 1) AS current_exposure_level,
    (SELECT ea.expires_at
     FROM public.exposure_applications ea
     WHERE ea.topic_id = t.id
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
     LIMIT 1) AS exposure_expires_at
  FROM public.topics t
  WHERE t.status = 'active'
    AND t.is_hidden = false
    AND t.end_at > now()
  ORDER BY 
    -- 有曝光的優先（插隊）
    CASE 
      WHEN EXISTS (
        SELECT 1 FROM public.exposure_applications ea
        WHERE ea.topic_id = t.id
          AND ea.status = 'active'
          AND ea.expires_at > now()
      ) THEN 0
      ELSE 1
    END,
    -- 然後按創建時間排序
    t.created_at DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- 13. 每日重置曝光統計的函數（應在每日 00:00 執行）
CREATE OR REPLACE FUNCTION public.reset_daily_exposure_stats()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  -- 刪除過期的統計記錄（保留最近7天）
  DELETE FROM public.user_exposure_stats
  WHERE date < CURRENT_DATE - INTERVAL '7 days';
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  
  -- 自動過期舊的曝光申請
  PERFORM public.expire_old_exposure_applications();
  
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 14. 檢查並記錄曝光違規的函數
CREATE OR REPLACE FUNCTION public.check_exposure_violations()
RETURNS INTEGER AS $$
DECLARE
  v_violation_count INTEGER;
BEGIN
  -- 檢查投票數未達標的曝光主題
  INSERT INTO public.exposure_violations (user_id, topic_id, violation_type, violation_reason, penalty_until)
  SELECT DISTINCT
    ea.user_id,
    ea.topic_id,
    'low_votes'::TEXT,
    '曝光期間投票數未達最低門檻',
    now() + INTERVAL '24 hours'
  FROM public.exposure_applications ea
  INNER JOIN public.exposure_limits el ON el.exposure_level = ea.exposure_level
  INNER JOIN public.topics t ON t.id = ea.topic_id
  WHERE ea.status = 'active'
    AND ea.expires_at < now() -- 已過期
    AND COALESCE(
      (SELECT SUM((value->>'votes')::INTEGER)
       FROM jsonb_array_elements(t.options) AS value),
      0
    ) < el.min_votes_required
    AND NOT EXISTS (
      SELECT 1 FROM public.exposure_violations ev
      WHERE ev.user_id = ea.user_id
        AND ev.topic_id = ea.topic_id
        AND ev.violation_type = 'low_votes'
        AND ev.created_at > now() - INTERVAL '24 hours'
    );
  
  GET DIAGNOSTICS v_violation_count = ROW_COUNT;
  
  RETURN v_violation_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 15. 獲取用戶曝光狀態的函數
CREATE OR REPLACE FUNCTION public.get_user_exposure_status(p_user_id UUID)
RETURNS JSONB AS $$
DECLARE
  v_result JSONB;
  v_active_applications JSONB;
  v_today_stats JSONB;
BEGIN
  -- 獲取活躍的曝光申請
  SELECT jsonb_agg(
    jsonb_build_object(
      'id', ea.id,
      'topic_id', ea.topic_id,
      'exposure_level', ea.exposure_level,
      'expires_at', ea.expires_at,
      'applied_at', ea.applied_at
    )
  ) INTO v_active_applications
  FROM public.exposure_applications ea
  WHERE ea.user_id = p_user_id
    AND ea.status = 'active'
    AND ea.expires_at > now();
  
  -- 獲取今日統計
  SELECT jsonb_object_agg(
    es.exposure_level,
    jsonb_build_object(
      'count', es.application_count,
      'date', es.date
    )
  ) INTO v_today_stats
  FROM public.user_exposure_stats es
  WHERE es.user_id = p_user_id
    AND es.date = CURRENT_DATE;
  
  -- 檢查是否有處罰
  DECLARE
    v_penalty_until TIMESTAMPTZ;
  BEGIN
    SELECT MAX(penalty_until) INTO v_penalty_until
    FROM public.exposure_violations
    WHERE user_id = p_user_id
      AND (penalty_until IS NULL OR penalty_until > now());
  END;
  
  RETURN jsonb_build_object(
    'active_applications', COALESCE(v_active_applications, '[]'::jsonb),
    'today_stats', COALESCE(v_today_stats, '{}'::jsonb),
    'penalty_until', v_penalty_until
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON TABLE public.exposure_applications IS '曝光申請記錄表';
COMMENT ON TABLE public.exposure_limits IS '曝光限制配置表';
COMMENT ON TABLE public.user_exposure_stats IS '用戶曝光統計表（每日重置）';
COMMENT ON TABLE public.exposure_violations IS '曝光違規記錄表';

