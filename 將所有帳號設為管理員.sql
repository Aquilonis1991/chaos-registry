-- ========================================
-- 將所有現有帳號設為管理員
-- ⚠️ 警告：此操作會將所有用戶設為管理員，請謹慎使用
-- ========================================

-- 方法 1：直接插入（如果 RLS 允許）
-- 注意：如果 RLS 政策限制，可能需要使用 Service Role Key 執行

INSERT INTO public.admin_users (user_id, granted_by)
SELECT 
  id AS user_id,
  id AS granted_by  -- 自己授予自己（或改為 NULL）
FROM auth.users
WHERE id NOT IN (
  SELECT user_id FROM public.admin_users
)
ON CONFLICT (user_id) DO NOTHING;

-- 驗證結果
SELECT 
  '✅ 管理員設定完成' as status,
  COUNT(*) as total_users,
  (SELECT COUNT(*) FROM public.admin_users) as total_admins,
  (SELECT COUNT(*) FROM auth.users) as total_auth_users
FROM auth.users;

-- 查看所有管理員
SELECT 
  au.user_id,
  u.email,
  au.granted_at,
  au.created_at
FROM public.admin_users au
JOIN auth.users u ON u.id = au.user_id
ORDER BY au.created_at DESC;

-- ========================================
-- 方法 2：使用安全函數（如果需要繞過 RLS）
-- ========================================

-- 創建一個臨時函數來批量授予管理員權限
CREATE OR REPLACE FUNCTION public.grant_admin_to_all_users()
RETURNS TABLE (
  total_users INTEGER,
  new_admins INTEGER,
  existing_admins INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total_users INTEGER;
  v_new_admins INTEGER;
  v_existing_admins INTEGER;
BEGIN
  -- 獲取總用戶數
  SELECT COUNT(*) INTO v_total_users FROM auth.users;
  
  -- 獲取現有管理員數
  SELECT COUNT(*) INTO v_existing_admins FROM public.admin_users;
  
  -- 插入所有非管理員用戶
  INSERT INTO public.admin_users (user_id, granted_by)
  SELECT 
    id AS user_id,
    id AS granted_by
  FROM auth.users
  WHERE id NOT IN (
    SELECT user_id FROM public.admin_users
  )
  ON CONFLICT (user_id) DO NOTHING;
  
  -- 獲取新增的管理員數
  SELECT COUNT(*) - v_existing_admins INTO v_new_admins FROM public.admin_users;
  
  RETURN QUERY SELECT v_total_users, v_new_admins, v_existing_admins;
END;
$$;

-- 執行函數
SELECT * FROM public.grant_admin_to_all_users();

-- 清理臨時函數（可選）
-- DROP FUNCTION IF EXISTS public.grant_admin_to_all_users();

-- ========================================
-- 方法 3：只針對特定用戶（更安全）
-- ========================================

-- 如果只想將特定用戶設為管理員，使用以下方式：

-- 1. 查看所有用戶
SELECT id, email, created_at 
FROM auth.users 
ORDER BY created_at DESC;

-- 2. 將特定用戶設為管理員（替換用戶 ID）
-- INSERT INTO public.admin_users (user_id)
-- VALUES 
--   ('用戶ID1'::uuid),
--   ('用戶ID2'::uuid),
--   ('用戶ID3'::uuid)
-- ON CONFLICT (user_id) DO NOTHING;

-- ========================================
-- 方法 4：基於郵件地址批量設定（更精確）
-- ========================================

-- 如果只想將特定郵件域名的用戶設為管理員
-- INSERT INTO public.admin_users (user_id, granted_by)
-- SELECT 
--   u.id AS user_id,
--   u.id AS granted_by
-- FROM auth.users u
-- WHERE u.email LIKE '%@yourdomain.com'  -- 替換為你的域名
--   AND u.id NOT IN (SELECT user_id FROM public.admin_users)
-- ON CONFLICT (user_id) DO NOTHING;

-- ========================================
-- 驗證和檢查
-- ========================================

-- 檢查管理員列表
SELECT 
  au.user_id,
  u.email,
  p.nickname,
  au.granted_at,
  au.created_at
FROM public.admin_users au
JOIN auth.users u ON u.id = au.user_id
LEFT JOIN public.profiles p ON p.id = au.user_id
ORDER BY au.created_at DESC;

-- 統計資訊
SELECT 
  '總用戶數' as metric,
  COUNT(*)::text as value
FROM auth.users
UNION ALL
SELECT 
  '管理員數' as metric,
  COUNT(*)::text as value
FROM public.admin_users
UNION ALL
SELECT 
  '非管理員數' as metric,
  (SELECT COUNT(*) FROM auth.users 
   WHERE id NOT IN (SELECT user_id FROM public.admin_users))::text as value;

