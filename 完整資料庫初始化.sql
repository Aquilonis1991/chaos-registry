-- ========================================
-- VoteChaos 完整資料庫初始化 SQL
-- 在 Supabase Dashboard 的 SQL Editor 中執行
-- ========================================

-- ========================================
-- 1. 系統配置表
-- ========================================

CREATE TABLE IF NOT EXISTS public.system_config (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  key text NOT NULL UNIQUE,
  value jsonb NOT NULL,
  category text NOT NULL,
  description text,
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- 啟用 RLS
ALTER TABLE public.system_config ENABLE ROW LEVEL SECURITY;

-- 先刪除舊政策（如果存在）
DROP POLICY IF EXISTS "Only admins can view system config" ON public.system_config;
DROP POLICY IF EXISTS "Only admins can update system config" ON public.system_config;
DROP POLICY IF EXISTS "Only admins can insert system config" ON public.system_config;
DROP POLICY IF EXISTS "Anyone can view system config" ON public.system_config;

-- 允許所有人查看系統配置（讀取配置不需要管理員權限）
CREATE POLICY "Anyone can view system config"
ON public.system_config
FOR SELECT
USING (true);

-- 插入預設系統配置
INSERT INTO public.system_config (key, value, category, description) VALUES
  -- 儲值配置
  ('recharge_amounts', '{"1": 100, "5": 550, "10": 1200, "20": 2600}', 'recharge', '儲值金額對應的代幣數量'),
  
  -- 字數限制
  ('title_max_length', '200', 'validation', '主題標題最大字數'),
  ('title_min_length', '5', 'validation', '主題標題最小字數'),
  ('description_max_length', '150', 'validation', '主題描述最大字數'),
  
  -- 選項限制
  ('option_min_count', '2', 'validation', '最少選項數量'),
  ('option_max_count', '6', 'validation', '最多選項數量'),
  ('tags_max_count', '5', 'validation', '最多標籤數量'),
  
  -- 投票設定
  ('vote_button_amounts', '[1, 5, 10, 20, 50, 100]', 'voting', '投票按鈕數量'),
  ('vote_max_amount', '100', 'voting', '單次投票最大數量'),
  ('vote_min_amount', '1', 'voting', '單次投票最小數量'),
  
  -- 曝光成本
  ('exposure_costs', '{"normal": 30, "medium": 90, "high": 180}', 'topic_cost', '曝光方案成本'),
  
  -- 天數成本
  ('duration_costs', '{"1": 0, "2": 0, "3": 0, "4": 1, "5": 2, "6": 3, "7": 4, "8": 6, "9": 8, "10": 10, "11": 12, "12": 14, "13": 16, "14": 18, "15": 21, "16": 24, "17": 27, "18": 30}', 'topic_cost', '天數成本'),
  ('duration_min_days', '1', 'topic_cost', '最少天數'),
  ('duration_max_days', '30', 'topic_cost', '最多天數'),
  
  -- 任務獎勵
  ('mission_watch_ad_reward', '10', 'mission', '觀看廣告獎勵'),
  ('mission_watch_ad_limit', '5', 'mission', '每日觀看廣告上限'),
  ('mission_create_topic_reward', '5', 'mission', '發起主題獎勵'),
  ('mission_vote_reward', '2', 'mission', '投票獎勵'),
  
  -- 新用戶設定
  ('new_user_tokens', '50', 'user', '新用戶初始代幣'),
  
  -- 免費建立設定
  ('free_create_enabled', 'true', 'topic_cost', '啟用免費建立'),
  ('free_create_daily_login_days', '5', 'mission', '連續登入天數要求'),
  ('free_create_qualification_expire_hours', '24', 'topic_cost', '資格過期時間')
ON CONFLICT (key) DO NOTHING;

-- ========================================
-- 2. 免費建立資格表
-- ========================================

CREATE TABLE IF NOT EXISTS public.free_create_qualifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  qualification_type TEXT NOT NULL CHECK (qualification_type IN ('daily_login', 'mission_reward', 'admin_grant')),
  source TEXT,
  expires_at TIMESTAMPTZ,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 啟用 RLS
ALTER TABLE public.free_create_qualifications ENABLE ROW LEVEL SECURITY;

-- 刪除舊政策
DROP POLICY IF EXISTS "Users can view own free create qualifications" ON public.free_create_qualifications;
DROP POLICY IF EXISTS "Users can insert own free create qualifications" ON public.free_create_qualifications;
DROP POLICY IF EXISTS "Users can update own free create qualifications" ON public.free_create_qualifications;

-- 建立政策
CREATE POLICY "Users can view own free create qualifications"
  ON public.free_create_qualifications FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own free create qualifications"
  ON public.free_create_qualifications FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own free create qualifications"
  ON public.free_create_qualifications FOR UPDATE
  USING (auth.uid() = user_id);

-- ========================================
-- 3. 免費建立資格相關函數
-- ========================================

-- 檢查是否有免費資格
CREATE OR REPLACE FUNCTION public.has_free_create_qualification(check_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM public.free_create_qualifications
    WHERE user_id = check_user_id
    AND used_at IS NULL
    AND (expires_at IS NULL OR expires_at > now())
  );
END;
$$;

-- 使用免費資格
CREATE OR REPLACE FUNCTION public.use_free_create_qualification(check_user_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  qualification_id UUID;
BEGIN
  SELECT id INTO qualification_id
  FROM public.free_create_qualifications
  WHERE user_id = check_user_id
  AND used_at IS NULL
  AND (expires_at IS NULL OR expires_at > now())
  ORDER BY created_at ASC
  LIMIT 1;

  IF qualification_id IS NULL THEN
    RAISE EXCEPTION 'No available free create qualification';
  END IF;

  UPDATE public.free_create_qualifications
  SET used_at = now()
  WHERE id = qualification_id;

  RETURN qualification_id;
END;
$$;

-- 授予免費資格
CREATE OR REPLACE FUNCTION public.grant_free_create_qualification(
  target_user_id UUID,
  qualification_type TEXT,
  source TEXT DEFAULT NULL,
  expires_at TIMESTAMPTZ DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  qualification_id UUID;
BEGIN
  INSERT INTO public.free_create_qualifications (
    user_id,
    qualification_type,
    source,
    expires_at
  ) VALUES (
    target_user_id,
    qualification_type,
    source,
    expires_at
  ) RETURNING id INTO qualification_id;

  RETURN qualification_id;
END;
$$;

-- ========================================
-- 完成訊息
-- ========================================

SELECT 
  'Database initialization complete!' as status,
  (SELECT COUNT(*) FROM public.system_config) as config_count,
  'Ready to use' as message;



