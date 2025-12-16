-- ========================================
-- 新增管理員管理功能
-- 1. 新增3組管理者帳號及密碼（密碼為亂數）
-- 2. 修改 admin_users 表：添加 is_suspended 和 is_super_admin 欄位
-- 3. 創建函數：允許最高管理者暫停/恢復其他管理員權限
-- ========================================

-- 步驟 1：修改 admin_users 表，添加 is_suspended 和 is_super_admin 欄位
ALTER TABLE public.admin_users 
ADD COLUMN IF NOT EXISTS is_suspended BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS is_super_admin BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS suspended_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS suspended_by UUID REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS suspended_reason TEXT;

-- 創建索引以提高查詢效能
CREATE INDEX IF NOT EXISTS idx_admin_users_is_suspended ON public.admin_users(is_suspended) WHERE is_suspended = true;
CREATE INDEX IF NOT EXISTS idx_admin_users_is_super_admin ON public.admin_users(is_super_admin) WHERE is_super_admin = true;

-- 步驟 2：將指定用戶設為最高管理者
UPDATE public.admin_users
SET is_super_admin = true
WHERE user_id = '08fc94c1-bfb3-47ed-9191-b46fa24837f2';

-- 如果該用戶還不是管理員，先添加為管理員
INSERT INTO public.admin_users (user_id, is_super_admin)
VALUES ('08fc94c1-bfb3-47ed-9191-b46fa24837f2', true)
ON CONFLICT (user_id) DO UPDATE
SET is_super_admin = true;

-- 步驟 3：創建函數：暫停管理員權限
CREATE OR REPLACE FUNCTION public.suspend_admin(
  p_target_user_id UUID,
  p_suspending_admin_id UUID,
  p_reason TEXT DEFAULT NULL
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
  v_is_super_admin BOOLEAN;
BEGIN
  -- 檢查執行者是否為最高管理者
  SELECT is_super_admin INTO v_is_super_admin
  FROM public.admin_users
  WHERE user_id = p_suspending_admin_id AND is_suspended = false;
  
  IF NOT v_is_super_admin THEN
    RETURN QUERY SELECT false, '只有最高管理者可以暫停其他管理員的權限';
    RETURN;
  END IF;
  
  -- 不能暫停自己
  IF p_target_user_id = p_suspending_admin_id THEN
    RETURN QUERY SELECT false, '不能暫停自己的權限';
    RETURN;
  END IF;
  
  -- 不能暫停其他最高管理者
  IF EXISTS (
    SELECT 1 FROM public.admin_users
    WHERE user_id = p_target_user_id AND is_super_admin = true
  ) THEN
    RETURN QUERY SELECT false, '不能暫停其他最高管理者的權限';
    RETURN;
  END IF;
  
  -- 更新管理員狀態
  UPDATE public.admin_users
  SET 
    is_suspended = true,
    suspended_at = now(),
    suspended_by = p_suspending_admin_id,
    suspended_reason = p_reason
  WHERE user_id = p_target_user_id;
  
  -- 記錄審計日誌
  INSERT INTO public.audit_logs (
    user_id,
    action,
    resource_type,
    resource_id,
    metadata
  )
  VALUES (
    p_suspending_admin_id,
    'suspend_admin',
    'admin_users',
    p_target_user_id,
    jsonb_build_object(
      'target_user_id', p_target_user_id,
      'reason', p_reason
    )
  );
  
  RETURN QUERY SELECT true, '管理員權限已暫停';
END;
$$;

-- 步驟 4：創建函數：恢復管理員權限
CREATE OR REPLACE FUNCTION public.unsuspend_admin(
  p_target_user_id UUID,
  p_unsuspending_admin_id UUID
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
  v_is_super_admin BOOLEAN;
BEGIN
  -- 檢查執行者是否為最高管理者
  SELECT is_super_admin INTO v_is_super_admin
  FROM public.admin_users
  WHERE user_id = p_unsuspending_admin_id AND is_suspended = false;
  
  IF NOT v_is_super_admin THEN
    RETURN QUERY SELECT false, '只有最高管理者可以恢復其他管理員的權限';
    RETURN;
  END IF;
  
  -- 更新管理員狀態
  UPDATE public.admin_users
  SET 
    is_suspended = false,
    suspended_at = NULL,
    suspended_by = NULL,
    suspended_reason = NULL
  WHERE user_id = p_target_user_id;
  
  -- 記錄審計日誌
  INSERT INTO public.audit_logs (
    user_id,
    action,
    resource_type,
    resource_id,
    metadata
  )
  VALUES (
    p_unsuspending_admin_id,
    'unsuspend_admin',
    'admin_users',
    p_target_user_id,
    jsonb_build_object(
      'target_user_id', p_target_user_id
    )
  );
  
  RETURN QUERY SELECT true, '管理員權限已恢復';
END;
$$;

-- 步驟 5：更新 is_admin 函數，考慮 is_suspended 狀態
CREATE OR REPLACE FUNCTION public.is_admin(check_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.admin_users
    WHERE user_id = check_user_id
      AND is_suspended = false
  );
$$;

-- 步驟 6：創建函數：檢查是否為最高管理者
CREATE OR REPLACE FUNCTION public.is_super_admin(check_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.admin_users
    WHERE user_id = check_user_id
      AND is_super_admin = true
      AND is_suspended = false
  );
$$;

-- 步驟 7：創建函數：獲取所有管理員列表（包含暫停狀態）
CREATE OR REPLACE FUNCTION public.get_admin_list()
RETURNS TABLE (
  user_id UUID,
  email TEXT,
  nickname TEXT,
  is_super_admin BOOLEAN,
  is_suspended BOOLEAN,
  suspended_at TIMESTAMPTZ,
  suspended_by UUID,
  suspended_reason TEXT,
  granted_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    au.user_id,
    u.email::TEXT,
    p.nickname,
    au.is_super_admin,
    au.is_suspended,
    au.suspended_at,
    au.suspended_by,
    au.suspended_reason,
    au.granted_at
  FROM public.admin_users au
  JOIN auth.users u ON u.id = au.user_id
  LEFT JOIN public.profiles p ON p.id = au.user_id
  ORDER BY au.is_super_admin DESC, au.granted_at DESC;
END;
$$;

-- 步驟 8：更新 RLS 政策，允許管理員查看所有管理員記錄
DROP POLICY IF EXISTS "Only admins can view all admin records" ON public.admin_users;

CREATE POLICY "Only admins can view all admin records"
ON public.admin_users
FOR SELECT
USING (public.is_admin(auth.uid()));

-- 步驟 9：創建3組管理者帳號的 SQL 腳本（需要在 Supabase Dashboard 中手動執行或使用 Admin API）
-- 注意：由於 Supabase 的安全限制，無法直接通過 SQL 創建用戶，需要提供腳本供手動執行

-- 生成3組隨機密碼（使用 PostgreSQL 的 gen_random_uuid 生成）
DO $$
DECLARE
  v_password_1 TEXT := 'Admin' || substring(replace(gen_random_uuid()::TEXT, '-', '') FROM 1 FOR 8);
  v_password_2 TEXT := 'Admin' || substring(replace(gen_random_uuid()::TEXT, '-', '') FROM 1 FOR 8);
  v_password_3 TEXT := 'Admin' || substring(replace(gen_random_uuid()::TEXT, '-', '') FROM 1 FOR 8);
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE '管理員帳號創建資訊';
  RAISE NOTICE '========================================';
  RAISE NOTICE '';
  RAISE NOTICE '管理員 1:';
  RAISE NOTICE '  電子郵件: admin1@votechaos.app';
  RAISE NOTICE '  密碼: %', v_password_1;
  RAISE NOTICE '';
  RAISE NOTICE '管理員 2:';
  RAISE NOTICE '  電子郵件: admin2@votechaos.app';
  RAISE NOTICE '  密碼: %', v_password_2;
  RAISE NOTICE '';
  RAISE NOTICE '管理員 3:';
  RAISE NOTICE '  電子郵件: admin3@votechaos.app';
  RAISE NOTICE '  密碼: %', v_password_3;
  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE '請在 Supabase Dashboard > Authentication > Users 中手動創建這些帳號';
  RAISE NOTICE '或使用 Supabase CLI 執行以下命令：';
  RAISE NOTICE '';
  RAISE NOTICE 'supabase auth admin create-user --email admin1@votechaos.app --password "%"', v_password_1;
  RAISE NOTICE 'supabase auth admin create-user --email admin2@votechaos.app --password "%"', v_password_2;
  RAISE NOTICE 'supabase auth admin create-user --email admin3@votechaos.app --password "%"', v_password_3;
  RAISE NOTICE '';
  RAISE NOTICE '創建帳號後，請執行以下 SQL 將他們設為管理員：';
  RAISE NOTICE '';
  RAISE NOTICE 'INSERT INTO public.admin_users (user_id, is_super_admin)';
  RAISE NOTICE 'SELECT id, false FROM auth.users WHERE email IN (';
  RAISE NOTICE '  ''admin1@votechaos.app'',';
  RAISE NOTICE '  ''admin2@votechaos.app'',';
  RAISE NOTICE '  ''admin3@votechaos.app''';
  RAISE NOTICE ') ON CONFLICT (user_id) DO NOTHING;';
  RAISE NOTICE '========================================';
END $$;

-- 註釋：實際的密碼生成和帳號創建需要在 Supabase Dashboard 或使用 Admin API 完成
-- 此 migration 只負責設置表結構和函數



