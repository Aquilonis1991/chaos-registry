-- 創建聯絡我們和通知系統

-- ========================================
-- 1. 聯絡我們表 (contact_messages)
-- ========================================
CREATE TABLE IF NOT EXISTS public.contact_messages (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  category text NOT NULL CHECK (category IN ('bug', 'suggestion', 'question', 'complaint', 'other')),
  title text NOT NULL,
  content text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'resolved', 'closed')),
  admin_response text,
  admin_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- 啟用 RLS
ALTER TABLE public.contact_messages ENABLE ROW LEVEL SECURITY;

-- 先移除既有政策避免重複
DROP POLICY IF EXISTS "Users can view own contact messages" ON public.contact_messages;
DROP POLICY IF EXISTS "Users can insert own contact messages" ON public.contact_messages;
DROP POLICY IF EXISTS "Admins can view all contact messages" ON public.contact_messages;
DROP POLICY IF EXISTS "Admins can update contact messages" ON public.contact_messages;

-- RLS 政策：用戶可以查看自己的聯絡訊息
CREATE POLICY "Users can view own contact messages"
  ON public.contact_messages FOR SELECT
  USING (auth.uid() = user_id);

-- RLS 政策：用戶可以創建聯絡訊息
CREATE POLICY "Users can insert own contact messages"
  ON public.contact_messages FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- RLS 政策：管理員可以查看所有聯絡訊息
CREATE POLICY "Admins can view all contact messages"
  ON public.contact_messages FOR SELECT
  USING (public.is_admin(auth.uid()));

-- RLS 政策：管理員可以更新聯絡訊息
CREATE POLICY "Admins can update contact messages"
  ON public.contact_messages FOR UPDATE
  USING (public.is_admin(auth.uid()));

-- 創建索引
CREATE INDEX IF NOT EXISTS idx_contact_messages_user_id ON public.contact_messages(user_id);
CREATE INDEX IF NOT EXISTS idx_contact_messages_status ON public.contact_messages(status);
CREATE INDEX IF NOT EXISTS idx_contact_messages_created_at ON public.contact_messages(created_at DESC);

-- ========================================
-- 2. 通知表 (notifications)
-- ========================================
CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('announcement', 'personal', 'system')),
  title text NOT NULL,
  content text NOT NULL,
  is_read boolean NOT NULL DEFAULT false,
  read_at timestamp with time zone,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  expires_at timestamp with time zone
);

-- 啟用 RLS
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- 先移除既有政策避免重複
DROP POLICY IF EXISTS "Users can view own notifications" ON public.notifications;
DROP POLICY IF EXISTS "Users can update own notifications" ON public.notifications;
DROP POLICY IF EXISTS "Admins can create notifications" ON public.notifications;
DROP POLICY IF EXISTS "Admins can update all notifications" ON public.notifications;
DROP POLICY IF EXISTS "Admins can delete notifications" ON public.notifications;

-- RLS 政策：用戶可以查看自己的通知
CREATE POLICY "Users can view own notifications"
  ON public.notifications FOR SELECT
  USING (auth.uid() = user_id);

-- RLS 政策：用戶可以更新自己的通知（標記為已讀）
CREATE POLICY "Users can update own notifications"
  ON public.notifications FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- RLS 政策：管理員可以創建通知
CREATE POLICY "Admins can create notifications"
  ON public.notifications FOR INSERT
  WITH CHECK (public.is_admin(auth.uid()));

-- RLS 政策：管理員可以查看所有通知

-- RLS 政策：管理員可以更新所有通知
CREATE POLICY "Admins can update all notifications"
  ON public.notifications FOR UPDATE
  USING (public.is_admin(auth.uid()));

-- RLS 政策：管理員可以刪除通知
CREATE POLICY "Admins can delete notifications"
  ON public.notifications FOR DELETE
  USING (public.is_admin(auth.uid()));

-- ========================================
-- 3. UI 文字管理權限調整
-- ========================================

ALTER TABLE public.ui_texts ENABLE ROW LEVEL SECURITY;

-- 移除舊有政策，避免重複
DROP POLICY IF EXISTS "Anyone can view ui_texts" ON public.ui_texts;
DROP POLICY IF EXISTS "Service role can manage ui_texts" ON public.ui_texts;
DROP POLICY IF EXISTS "Admins can insert ui_texts" ON public.ui_texts;
DROP POLICY IF EXISTS "Admins can update ui_texts" ON public.ui_texts;
DROP POLICY IF EXISTS "Admins can delete ui_texts" ON public.ui_texts;

-- 使用者 / 前台可讀取文字
CREATE POLICY "Anyone can view ui_texts"
  ON public.ui_texts FOR SELECT
  USING (true);

-- 提供管理員新增 / 更新 / 刪除的權限
CREATE POLICY "Admins can insert ui_texts"
  ON public.ui_texts FOR INSERT
  WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "Admins can update ui_texts"
  ON public.ui_texts FOR UPDATE
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "Admins can delete ui_texts"
  ON public.ui_texts FOR DELETE
  USING (public.is_admin(auth.uid()));

-- 批次匯入 UI 文字（CSV 導入）
CREATE OR REPLACE FUNCTION public.import_ui_texts_from_csv(
  p_rows jsonb
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  item jsonb;
  v_key text;
  v_category text;
  v_zh text;
  v_en text;
  v_ja text;
  v_desc text;
  imported_count integer := 0;
  errors jsonb := '[]'::jsonb;
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  IF p_rows IS NULL OR jsonb_typeof(p_rows) <> 'array' THEN
    RETURN jsonb_build_object('imported_count', 0, 'errors', jsonb_build_array('Invalid input format'));
  END IF;

  FOR item IN SELECT * FROM jsonb_array_elements(p_rows)
  LOOP
    BEGIN
      v_key := NULLIF(trim(item->> 'key'), '');
      v_category := COALESCE(NULLIF(trim(item->> 'category'), ''), 'general');
      v_zh := NULLIF(trim(item->> 'zh'), '');
      v_en := NULLIF(trim(item->> 'en'), '');
      v_ja := NULLIF(trim(item->> 'ja'), '');
      v_desc := NULLIF(trim(item->> 'description'), '');

      IF v_key IS NULL OR v_zh IS NULL THEN
        errors := errors || jsonb_build_array(jsonb_build_object('key', item->> 'key', 'error', 'Key and zh are required'));
        CONTINUE;
      END IF;

      INSERT INTO public.ui_texts (key, category, value, zh, en, ja, description)
      VALUES (v_key, v_category, v_zh, v_zh, v_en, v_ja, v_desc)
      ON CONFLICT (key) DO UPDATE
      SET
        category = EXCLUDED.category,
        value = EXCLUDED.value,
        zh = EXCLUDED.zh,
        en = EXCLUDED.en,
        ja = EXCLUDED.ja,
        description = EXCLUDED.description,
        updated_at = now();

      imported_count := imported_count + 1;
    EXCEPTION WHEN OTHERS THEN
      errors := errors || jsonb_build_array(jsonb_build_object('key', COALESCE(v_key, item->> 'key'), 'error', SQLERRM));
    END;
  END LOOP;

  RETURN jsonb_build_object('imported_count', imported_count, 'errors', errors);
END;
$$;

-- 創建索引
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON public.notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON public.notifications(is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_type ON public.notifications(type);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON public.notifications(created_at DESC);

-- 創建函數：標記通知為已讀
CREATE OR REPLACE FUNCTION public.mark_notification_read(p_notification_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.notifications
  SET is_read = true,
      read_at = now()
  WHERE id = p_notification_id
    AND user_id = auth.uid();
END;
$$;

-- 創建函數：標記所有通知為已讀
CREATE OR REPLACE FUNCTION public.mark_all_notifications_read()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.notifications
  SET is_read = true,
      read_at = now()
  WHERE user_id = auth.uid()
    AND is_read = false;
END;
$$;

-- 創建函數：獲取未讀通知數量
CREATE OR REPLACE FUNCTION public.get_unread_notification_count()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer;
BEGIN
  SELECT COUNT(*) INTO v_count
  FROM public.notifications
  WHERE user_id = auth.uid()
    AND is_read = false
    AND (expires_at IS NULL OR expires_at > now());
  
  RETURN v_count;
END;
$$;

-- 管理員查詢聯絡訊息
CREATE OR REPLACE FUNCTION public.admin_list_contact_messages()
RETURNS TABLE (
  id uuid,
  user_id uuid,
  category text,
  title text,
  content text,
  status text,
  admin_response text,
  admin_id uuid,
  created_at timestamptz,
  updated_at timestamptz,
  user_nickname text,
  user_email text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  RETURN QUERY
  SELECT
    cm.id,
    cm.user_id,
    cm.category,
    cm.title,
    cm.content,
    cm.status,
    cm.admin_response,
    cm.admin_id,
    cm.created_at,
    cm.updated_at,
    p.nickname AS user_nickname,
    au.email::text AS user_email
  FROM public.contact_messages cm
  LEFT JOIN public.profiles p ON p.id = cm.user_id
  LEFT JOIN auth.users au ON au.id = cm.user_id
  ORDER BY cm.created_at DESC;
END;
$$;

-- 刷新 Schema Cache
NOTIFY pgrst, 'reload schema';

