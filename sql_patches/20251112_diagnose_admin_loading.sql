-- ========================================
-- 診斷後台載入問題
-- ========================================

-- 1. 檢查 admin_users 表是否存在
SELECT 
  CASE 
    WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'admin_users')
    THEN '✓ admin_users 表存在'
    ELSE '✗ admin_users 表不存在'
  END AS table_check;

-- 2. 檢查 admin_users 表的結構
SELECT 
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'admin_users'
ORDER BY ordinal_position;

-- 3. 檢查 RLS 政策
SELECT 
  policyname,
  permissive,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE schemaname = 'public' 
  AND tablename = 'admin_users';

-- 4. 檢查當前認證用戶是否為管理員
-- 注意：這需要在有認證的環境下執行（Supabase Dashboard 的 SQL Editor）
SELECT 
  CASE 
    WHEN auth.uid() IS NULL
    THEN '⚠ 未登入，無法檢查'
    WHEN EXISTS (
      SELECT 1 FROM public.admin_users 
      WHERE user_id = auth.uid()
    )
    THEN '✓ 當前用戶是管理員'
    ELSE '✗ 當前用戶不是管理員'
  END AS admin_status,
  auth.uid() AS current_user_id;

-- 5. 列出所有管理員
SELECT 
  au.user_id,
  p.nickname,
  au.granted_at,
  au.granted_by
FROM public.admin_users au
LEFT JOIN public.profiles p ON p.id = au.user_id
ORDER BY au.granted_at DESC;

-- 6. 檢查 RLS 是否啟用
SELECT 
  tablename,
  rowsecurity
FROM pg_tables
WHERE schemaname = 'public' 
  AND tablename = 'admin_users';

-- 7. 測試查詢（模擬前端查詢）
-- 注意：這需要在有認證的環境下執行
SELECT user_id 
FROM public.admin_users 
WHERE user_id = auth.uid()
LIMIT 1;

-- 8. 如果需要將特定用戶設為管理員，請執行以下 SQL（替換 <USER_ID> 為實際的 UUID）
-- INSERT INTO public.admin_users (user_id) 
-- VALUES ('<USER_ID>'::uuid)
-- ON CONFLICT (user_id) DO NOTHING;

-- 9. 查看所有用戶及其管理員狀態
SELECT 
  p.id AS user_id,
  p.nickname,
  p.avatar,
  p.tokens,
  CASE 
    WHEN au.user_id IS NOT NULL THEN '✓ 是管理員'
    ELSE '✗ 不是管理員'
  END AS admin_status,
  au.granted_at AS admin_granted_at,
  p.created_at AS user_created_at,
  p.last_login
FROM public.profiles p
LEFT JOIN public.admin_users au ON au.user_id = p.id
ORDER BY au.granted_at DESC NULLS LAST, p.created_at DESC
LIMIT 50;

