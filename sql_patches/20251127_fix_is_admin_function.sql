-- 檢查並修復 is_admin 函數
-- 解決後台一直讀取中的問題

-- 1. 檢查函數是否存在
SELECT 
  'is_admin function check' as check_type,
  EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public'
    AND p.proname = 'is_admin'
  ) as function_exists;

-- 2. 檢查 admin_users 表是否存在
SELECT 
  'admin_users table check' as check_type,
  EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public'
    AND table_name = 'admin_users'
  ) as table_exists;

-- 3. 創建或修復 is_admin 函數
CREATE OR REPLACE FUNCTION public.is_admin(check_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
  v_is_admin boolean := false;
BEGIN
  -- 檢查 admin_users 表中是否存在該用戶
  SELECT EXISTS (
    SELECT 1
    FROM public.admin_users
    WHERE user_id = check_user_id
  ) INTO v_is_admin;
  
  RETURN COALESCE(v_is_admin, false);
END;
$$;

-- 4. 授予執行權限
GRANT EXECUTE ON FUNCTION public.is_admin(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin(uuid) TO anon;
GRANT EXECUTE ON FUNCTION public.is_admin(uuid) TO service_role;

-- 5. 刷新 Schema Cache
NOTIFY pgrst, 'reload schema';

-- 6. 測試函數（可選）
-- SELECT public.is_admin('08fc94c1-bfb3-47ed-9191-b46fa24837f2'::uuid);


