-- 修復建立主題功能：建立缺失的資料庫函數和表
-- 請在 Supabase Dashboard 的 SQL Editor 中執行此檔案

-- 1. 建立 free_create_qualifications 表（如果不存在）
CREATE TABLE IF NOT EXISTS public.free_create_qualifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  qualification_type TEXT NOT NULL CHECK (qualification_type IN ('daily_login', 'mission_reward', 'admin_grant')),
  source TEXT,
  expires_at TIMESTAMPTZ,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 2. 啟用 RLS
ALTER TABLE public.free_create_qualifications ENABLE ROW LEVEL SECURITY;

-- 3. 建立 RLS 政策
DROP POLICY IF EXISTS "Users can view own free create qualifications" ON public.free_create_qualifications;
CREATE POLICY "Users can view own free create qualifications"
  ON public.free_create_qualifications FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own free create qualifications" ON public.free_create_qualifications;
CREATE POLICY "Users can insert own free create qualifications"
  ON public.free_create_qualifications FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own free create qualifications" ON public.free_create_qualifications;
CREATE POLICY "Users can update own free create qualifications"
  ON public.free_create_qualifications FOR UPDATE
  USING (auth.uid() = user_id);

-- 4. 建立檢查免費資格的函數
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

-- 5. 建立使用免費資格的函數
CREATE OR REPLACE FUNCTION public.use_free_create_qualification(check_user_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  qualification_id UUID;
BEGIN
  -- 找到可用的資格
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

  -- 標記為已使用
  UPDATE public.free_create_qualifications
  SET used_at = now()
  WHERE id = qualification_id;

  RETURN qualification_id;
END;
$$;

-- 6. 建立授予免費資格的函數
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

-- 7. 新增系統配置（如果不存在）
INSERT INTO public.system_config (key, value, category, description) VALUES
  ('free_create_enabled', 'true', 'topic_cost', '是否啟用免費發起主題功能'),
  ('free_create_daily_login_days', '5', 'mission', '連續登入幾天獲得免費發起資格'),
  ('free_create_qualification_expire_hours', '24', 'topic_cost', '免費發起資格過期時間（小時）')
ON CONFLICT (key) DO NOTHING;

-- 完成！
SELECT 'Free create qualification system installed successfully!' as status;



