-- ========================================
-- 20251122 - 修復 system_config 更新問題
-- ========================================
-- 確保管理員可以更新系統配置

-- 1. 檢查並刪除舊的 UPDATE 政策（如果存在）
DROP POLICY IF EXISTS "Only admins can update system config" ON public.system_config;
DROP POLICY IF EXISTS "Admins can update system config" ON public.system_config;

-- 2. 創建新的 UPDATE 政策（允許管理員更新）
CREATE POLICY "Admins can update system config"
ON public.system_config
FOR UPDATE
USING (public.is_admin(auth.uid()))
WITH CHECK (public.is_admin(auth.uid()));

-- 3. 驗證政策
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE tablename = 'system_config' AND schemaname = 'public'
ORDER BY policyname;

-- 4. 測試更新（可選，用於驗證）
-- 注意：這需要管理員權限才能執行
-- UPDATE public.system_config 
-- SET value = to_jsonb(5::integer), updated_at = now()
-- WHERE key = 'ad_insertion_interval'
-- RETURNING key, value, updated_at;

