-- ========================================
-- 修復用戶限制表和檢舉功能
-- 1. 確保 user_restrictions 表存在
-- 2. 修復 handle_topic_report 函數中的歧義錯誤
-- ========================================

-- 1. 創建用戶功能限制表（如果不存在）
CREATE TABLE IF NOT EXISTS public.user_restrictions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  restriction_type TEXT NOT NULL CHECK (restriction_type IN (
    'create_topic', 
    'vote', 
    'complete_mission', 
    'modify_name', 
    'recharge'
  )),
  is_active BOOLEAN NOT NULL DEFAULT true,
  reason TEXT,
  restricted_by UUID REFERENCES auth.users(id),
  restricted_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ, -- 可選：限制到期時間
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, restriction_type)
);

-- 啟用 RLS
ALTER TABLE public.user_restrictions ENABLE ROW LEVEL SECURITY;

-- 刪除舊的 RLS 政策（如果存在）
DROP POLICY IF EXISTS "Users can view own restrictions" ON public.user_restrictions;
DROP POLICY IF EXISTS "Admins can view all restrictions" ON public.user_restrictions;
DROP POLICY IF EXISTS "Admins can manage restrictions" ON public.user_restrictions;

-- 創建 RLS 政策
CREATE POLICY "Users can view own restrictions"
  ON public.user_restrictions FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Admins can view all restrictions"
  ON public.user_restrictions FOR SELECT
  USING (public.is_admin(auth.uid()));

CREATE POLICY "Admins can manage restrictions"
  ON public.user_restrictions FOR ALL
  USING (public.is_admin(auth.uid()));

-- 創建索引（如果不存在）
CREATE INDEX IF NOT EXISTS idx_user_restrictions_user ON public.user_restrictions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_restrictions_type ON public.user_restrictions(restriction_type);
CREATE INDEX IF NOT EXISTS idx_user_restrictions_active ON public.user_restrictions(user_id, is_active) WHERE is_active = true;

-- 2. 修復 handle_topic_report 函數（解決 report_count 歧義問題）
CREATE OR REPLACE FUNCTION public.handle_topic_report(
  p_topic_id UUID,
  p_reporter_id UUID,
  p_report_type TEXT,
  p_reason TEXT,
  p_details TEXT DEFAULT NULL
)
RETURNS TABLE (
  success BOOLEAN,
  message TEXT,
  auto_hidden BOOLEAN,
  report_count INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_report_count INTEGER;
  v_auto_hidden BOOLEAN := false;
  v_inserted BOOLEAN := false;
BEGIN
  -- 檢查是否已經檢舉過
  IF EXISTS (
    SELECT 1 FROM public.reports
    WHERE reporter_id = p_reporter_id
      AND target_type = 'topic'
      AND target_id = p_topic_id
  ) THEN
    RETURN QUERY SELECT false, '你已經檢舉過此主題', false, 0;
    RETURN;
  END IF;

  -- 插入檢舉記錄
  INSERT INTO public.reports (
    reporter_id,
    target_type,
    target_id,
    report_type,
    reason,
    details
  )
  VALUES (
    p_reporter_id,
    'topic',
    p_topic_id,
    p_report_type,
    p_reason,
    p_details
  )
  ON CONFLICT (reporter_id, target_type, target_id) DO NOTHING
  RETURNING true INTO v_inserted;

  IF NOT v_inserted THEN
    RETURN QUERY SELECT false, '檢舉失敗', false, 0;
    RETURN;
  END IF;

  -- 更新主題檢舉計數（明確指定表名避免歧義）
  UPDATE public.topics
  SET report_count = COALESCE(public.topics.report_count, 0) + 1
  WHERE public.topics.id = p_topic_id
  RETURNING public.topics.report_count INTO v_report_count;

  -- 如果用戶不存在
  IF v_report_count IS NULL THEN
    RETURN QUERY SELECT false, '主題不存在', false, 0;
    RETURN;
  END IF;

  -- 檢查是否達到 10 次檢舉（不同用戶）
  IF v_report_count >= 10 THEN
    -- 檢查是否確實有 10 個不同用戶檢舉
    IF (
      SELECT COUNT(DISTINCT reporter_id)
      FROM public.reports
      WHERE target_type = 'topic'
        AND target_id = p_topic_id
        AND status != 'rejected'
    ) >= 10 THEN
      -- 自動隱藏
      UPDATE public.topics
      SET 
        is_hidden = true,
        auto_hidden = true,
        hidden_at = now(),
        hidden_reason = '因被 10 位不同用戶檢舉而自動隱藏'
      WHERE id = p_topic_id;

      v_auto_hidden := true;
    END IF;
  END IF;

  RETURN QUERY SELECT true, '檢舉成功', v_auto_hidden, v_report_count;
END;
$$;

-- 3. 驗證表和函數
SELECT 
  'user_restrictions table' as object_type,
  EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'user_restrictions'
  ) as exists;

SELECT 
  'handle_topic_report function' as object_type,
  EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public'
    AND p.proname = 'handle_topic_report'
  ) as exists;

-- 4. 重新載入 Schema Cache
SELECT pg_notify('pgrst', 'reload schema');
SELECT pg_notify('pgrst', 'reload schema');
SELECT pg_notify('pgrst', 'reload schema');

