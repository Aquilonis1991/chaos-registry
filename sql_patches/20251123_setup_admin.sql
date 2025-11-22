-- ========================================
-- 20251123 - 設定後台管理員
-- ========================================
-- 此腳本用於將您的帳號設為管理員，以便訪問後台

-- 步驟 1：查看所有用戶（找到您的帳號）
SELECT 
  id,
  email,
  created_at,
  CASE 
    WHEN id IN (SELECT user_id FROM public.admin_users) 
    THEN '✅ 已是管理員' 
    ELSE '❌ 非管理員' 
  END AS admin_status
FROM auth.users
ORDER BY created_at DESC;

-- 步驟 2：將您的帳號設為管理員
-- 方法 A：如果您知道自己的 email，使用以下 SQL（替換為您的 email）
-- INSERT INTO public.admin_users (user_id, granted_by)
-- SELECT 
--   u.id AS user_id,
--   u.id AS granted_by
-- FROM auth.users u
-- WHERE u.email = 'your-email@example.com'  -- 替換為您的 email
--   AND u.id NOT IN (SELECT user_id FROM public.admin_users)
-- ON CONFLICT (user_id) DO NOTHING;

-- 方法 B：將所有現有帳號設為管理員（快速方式）
INSERT INTO public.admin_users (user_id, granted_by)
SELECT 
  id AS user_id,
  id AS granted_by
FROM auth.users
WHERE id NOT IN (
  SELECT user_id FROM public.admin_users
)
ON CONFLICT (user_id) DO NOTHING;

-- 步驟 3：驗證管理員設定
SELECT 
  '✅ 管理員設定完成' as status,
  COUNT(*) as total_admins,
  (SELECT COUNT(*) FROM auth.users) as total_users
FROM public.admin_users;

-- 步驟 4：查看所有管理員列表
SELECT 
  au.user_id,
  u.email,
  au.granted_at,
  au.created_at
FROM public.admin_users au
JOIN auth.users u ON u.id = au.user_id
ORDER BY au.created_at DESC;

