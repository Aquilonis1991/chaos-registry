-- ========================================
-- 重新設計主題與檢舉系統
-- 1. 移除審核機制，主題直接顯示
-- 2. 添加隱藏機制
-- 3. 添加檢舉計數和自動隱藏
-- 4. 添加用戶功能限制系統
-- ========================================

-- ========================================
-- 1. 修改 topics 表結構
-- ========================================

-- 移除審核相關欄位（如果存在）
ALTER TABLE public.topics 
  DROP COLUMN IF EXISTS approval_status,
  DROP COLUMN IF EXISTS reviewed_by,
  DROP COLUMN IF EXISTS reviewed_at,
  DROP COLUMN IF EXISTS rejection_reason;

-- 添加隱藏相關欄位（使用 DO 區塊確保欄位不存在時才添加）
DO $$
BEGIN
  -- 添加 is_hidden 欄位
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'topics' 
    AND column_name = 'is_hidden'
  ) THEN
    ALTER TABLE public.topics 
    ADD COLUMN is_hidden BOOLEAN NOT NULL DEFAULT false;
  END IF;

  -- 添加 hidden_by 欄位
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'topics' 
    AND column_name = 'hidden_by'
  ) THEN
    ALTER TABLE public.topics 
    ADD COLUMN hidden_by UUID REFERENCES auth.users(id);
  END IF;

  -- 添加 hidden_at 欄位
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'topics' 
    AND column_name = 'hidden_at'
  ) THEN
    ALTER TABLE public.topics 
    ADD COLUMN hidden_at TIMESTAMPTZ;
  END IF;

  -- 添加 hidden_reason 欄位
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'topics' 
    AND column_name = 'hidden_reason'
  ) THEN
    ALTER TABLE public.topics 
    ADD COLUMN hidden_reason TEXT;
  END IF;

  -- 添加 report_count 欄位
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'topics' 
    AND column_name = 'report_count'
  ) THEN
    ALTER TABLE public.topics 
    ADD COLUMN report_count INTEGER NOT NULL DEFAULT 0;
  END IF;

  -- 添加 auto_hidden 欄位
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'topics' 
    AND column_name = 'auto_hidden'
  ) THEN
    ALTER TABLE public.topics 
    ADD COLUMN auto_hidden BOOLEAN NOT NULL DEFAULT false;
  END IF;
END $$;

-- 創建索引
CREATE INDEX IF NOT EXISTS idx_topics_is_hidden ON public.topics(is_hidden);
CREATE INDEX IF NOT EXISTS idx_topics_report_count ON public.topics(report_count);
DROP INDEX IF EXISTS idx_topics_approval_status;

-- ========================================
-- 2. 修改 topics RLS 政策
-- ========================================

-- 刪除舊的審核相關政策
DROP POLICY IF EXISTS "Anyone can view approved active topics" ON public.topics;
DROP POLICY IF EXISTS "Creators can view own pending topics" ON public.topics;
DROP POLICY IF EXISTS "Creators can update own topics" ON public.topics;
DROP POLICY IF EXISTS "Admins can update approval status" ON public.topics;
DROP POLICY IF EXISTS "Admins can manage topics" ON public.topics;

-- 新的政策：只顯示未隱藏的活躍主題
CREATE POLICY "Anyone can view active non-hidden topics"
  ON public.topics FOR SELECT
  USING (status = 'active' AND is_hidden = false);

-- 允許創建者查看自己的主題（包括隱藏的）
CREATE POLICY "Creators can view own topics"
  ON public.topics FOR SELECT
  USING (creator_id = auth.uid());

-- 允許管理員查看所有主題
CREATE POLICY "Admins can view all topics"
  ON public.topics FOR SELECT
  USING (public.is_admin(auth.uid()));

-- 允許創建者更新自己的主題（但不能修改隱藏狀態）
CREATE POLICY "Creators can update own topics"
  ON public.topics FOR UPDATE
  USING (creator_id = auth.uid())
  WITH CHECK (
    creator_id = auth.uid() 
    AND (is_hidden = OLD.is_hidden OR NOT is_hidden) -- 創建者不能隱藏自己的主題
  );

-- 允許管理員更新所有欄位（包括隱藏狀態）
CREATE POLICY "Admins can manage topics"
  ON public.topics FOR UPDATE
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

-- ========================================
-- 3. 修改 reports 表（如果不存在則創建）
-- ========================================

CREATE TABLE IF NOT EXISTS public.reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  target_type TEXT NOT NULL CHECK (target_type IN ('topic', 'user')),
  target_id UUID NOT NULL,
  report_type TEXT NOT NULL,
  reason TEXT NOT NULL,
  details TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'reviewing', 'resolved', 'rejected', 'closed')),
  reviewed_by UUID REFERENCES auth.users(id),
  reviewed_at TIMESTAMPTZ,
  admin_notes TEXT,
  resolution TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(reporter_id, target_type, target_id) -- 每個用戶只能檢舉同一個目標一次
);

-- 啟用 RLS
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;

-- RLS 政策
CREATE POLICY "Users can view own reports"
  ON public.reports FOR SELECT
  USING (reporter_id = auth.uid());

CREATE POLICY "Users can create reports"
  ON public.reports FOR INSERT
  WITH CHECK (reporter_id = auth.uid());

CREATE POLICY "Admins can view all reports"
  ON public.reports FOR SELECT
  USING (public.is_admin(auth.uid()));

CREATE POLICY "Admins can update reports"
  ON public.reports FOR UPDATE
  USING (public.is_admin(auth.uid()));

-- 索引
CREATE INDEX IF NOT EXISTS idx_reports_target ON public.reports(target_type, target_id);
CREATE INDEX IF NOT EXISTS idx_reports_status ON public.reports(status);
CREATE INDEX IF NOT EXISTS idx_reports_reporter ON public.reports(reporter_id);

-- ========================================
-- 4. 創建用戶功能限制表
-- ========================================

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

-- RLS 政策
CREATE POLICY "Users can view own restrictions"
  ON public.user_restrictions FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Admins can view all restrictions"
  ON public.user_restrictions FOR SELECT
  USING (public.is_admin(auth.uid()));

CREATE POLICY "Admins can manage restrictions"
  ON public.user_restrictions FOR ALL
  USING (public.is_admin(auth.uid()));

-- 索引
CREATE INDEX IF NOT EXISTS idx_user_restrictions_user ON public.user_restrictions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_restrictions_type ON public.user_restrictions(restriction_type);
CREATE INDEX IF NOT EXISTS idx_user_restrictions_active ON public.user_restrictions(user_id, is_active) WHERE is_active = true;

-- ========================================
-- 5. 創建函數：檢查用戶功能限制
-- ========================================

CREATE OR REPLACE FUNCTION public.check_user_restriction(
  p_user_id UUID,
  p_restriction_type TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_restricted BOOLEAN := false;
BEGIN
  SELECT EXISTS (
    SELECT 1
    FROM public.user_restrictions
    WHERE user_id = p_user_id
      AND restriction_type = p_restriction_type
      AND is_active = true
      AND (expires_at IS NULL OR expires_at > now())
  ) INTO v_restricted;

  RETURN v_restricted;
END;
$$;

-- ========================================
-- 6. 創建函數：處理主題檢舉（自動隱藏邏輯）
-- ========================================

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

  -- 更新主題檢舉計數
  UPDATE public.topics
  SET report_count = report_count + 1
  WHERE id = p_topic_id
  RETURNING report_count INTO v_report_count;

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

-- ========================================
-- 7. 創建函數：處理用戶檢舉
-- ========================================

CREATE OR REPLACE FUNCTION public.handle_user_report(
  p_target_user_id UUID,
  p_reporter_id UUID,
  p_report_type TEXT,
  p_reason TEXT,
  p_details TEXT DEFAULT NULL
)
RETURNS TABLE (
  success BOOLEAN,
  message TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_inserted BOOLEAN := false;
BEGIN
  -- 不能檢舉自己
  IF p_target_user_id = p_reporter_id THEN
    RETURN QUERY SELECT false, '不能檢舉自己';
    RETURN;
  END IF;

  -- 檢查是否已經檢舉過
  IF EXISTS (
    SELECT 1 FROM public.reports
    WHERE reporter_id = p_reporter_id
      AND target_type = 'user'
      AND target_id = p_target_user_id
  ) THEN
    RETURN QUERY SELECT false, '你已經檢舉過此用戶';
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
    'user',
    p_target_user_id,
    p_report_type,
    p_reason,
    p_details
  )
  ON CONFLICT (reporter_id, target_type, target_id) DO NOTHING
  RETURNING true INTO v_inserted;

  IF NOT v_inserted THEN
    RETURN QUERY SELECT false, '檢舉失敗';
    RETURN;
  END IF;

  RETURN QUERY SELECT true, '檢舉成功，管理員將進行審核';
END;
$$;

-- ========================================
-- 8. 更新現有主題（移除審核狀態，設置為可見）
-- ========================================

UPDATE public.topics
SET 
  is_hidden = false,
  auto_hidden = false,
  report_count = 0
WHERE is_hidden IS NULL OR auto_hidden IS NULL;

-- ========================================
-- 9. 重載 Schema Cache
-- ========================================

SELECT pg_notify('pgrst','reload schema');

