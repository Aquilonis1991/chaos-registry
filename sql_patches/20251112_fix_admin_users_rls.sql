-- ========================================
-- 修復 admin_users 表的 RLS 政策
-- 確保用戶可以查詢自己的管理員狀態
-- ========================================

-- 1. 確保表存在
CREATE TABLE IF NOT EXISTS public.admin_users (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  granted_at TIMESTAMPTZ DEFAULT now(),
  granted_by UUID REFERENCES auth.users(id)
);

-- 2. 啟用 RLS
ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;

-- 3. 刪除舊的政策（如果存在）
DROP POLICY IF EXISTS "Users can view own admin status" ON public.admin_users;
DROP POLICY IF EXISTS "Service role can manage admin_users" ON public.admin_users;

-- 4. 創建新的 SELECT 政策：用戶可以查看自己的管理員狀態
CREATE POLICY "Users can view own admin status"
  ON public.admin_users
  FOR SELECT
  USING (user_id = auth.uid());

-- 5. 創建管理政策：僅服務角色可以管理（INSERT/UPDATE/DELETE）
-- 注意：這需要通過 Supabase Dashboard 或 Edge Functions 來管理
CREATE POLICY "Service role can manage admin_users"
  ON public.admin_users
  FOR ALL
  USING (false)
  WITH CHECK (false);

-- 6. 驗證政策
SELECT 
  policyname,
  permissive,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE schemaname = 'public' 
  AND tablename = 'admin_users'
ORDER BY policyname;

