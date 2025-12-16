-- 優化 is_admin 函數性能
-- 添加索引和優化查詢，確保快速響應

-- 1. 確保 admin_users 表有索引（如果不存在）
CREATE INDEX IF NOT EXISTS idx_admin_users_user_id ON public.admin_users(user_id);

-- 2. 優化 is_admin 函數（使用更高效的查詢）
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
    LIMIT 1
  );
$$;

-- 3. 授予執行權限
GRANT EXECUTE ON FUNCTION public.is_admin(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin(uuid) TO anon;
GRANT EXECUTE ON FUNCTION public.is_admin(uuid) TO service_role;

-- 4. 分析表以更新統計信息（幫助查詢優化器）
ANALYZE public.admin_users;

-- 5. 刷新 Schema Cache
NOTIFY pgrst, 'reload schema';

-- 6. 驗證函數存在
SELECT 
  'is_admin function optimized' as status,
  EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public'
    AND p.proname = 'is_admin'
  ) as function_exists;


