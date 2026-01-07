-- ========================================
-- 強制重置 is_admin 函數
-- 使用 VOLATILE 確保不緩存，並使用 SECURITY DEFINER 繞過 RLS
-- ========================================

-- 1. 刪除舊函數（為了乾淨重建）
DROP FUNCTION IF EXISTS public.is_admin(uuid);

-- 2. 重建 is_admin 函數
CREATE OR REPLACE FUNCTION public.is_admin(check_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER -- 關鍵：繞過 RLS 權限檢查
SET search_path = public -- 關鍵：鎖定搜索路徑
VOLATILE -- 關鍵：避免不必要的緩存
AS $$
DECLARE
  v_exists boolean;
BEGIN
  -- 簡單直接的查詢
  SELECT EXISTS (
    SELECT 1 
    FROM public.admin_users 
    WHERE user_id = check_user_id
  ) INTO v_exists;
  
  RETURN v_exists;
END;
$$;

-- 3. 授予權限
GRANT EXECUTE ON FUNCTION public.is_admin(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin(uuid) TO anon;
GRANT EXECUTE ON FUNCTION public.is_admin(uuid) TO service_role;

-- 4. 確保 admin_users 表的 RLS 允許讀取（雙重保險）
-- 雖然 SECURITY DEFINER 已經繞過 RLS，但如果前端直接查詢表，還是需要 RLS
DROP POLICY IF EXISTS "Users can view own admin status" ON public.admin_users;
CREATE POLICY "Users can view own admin status"
  ON public.admin_users
  FOR SELECT
  USING (user_id = auth.uid());

-- 5. 確保 admin_users 表存在
CREATE TABLE IF NOT EXISTS public.admin_users (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  granted_at TIMESTAMPTZ DEFAULT now()
);

-- 6. 發送 Schema Reload 通知
NOTIFY pgrst, 'reload schema';
