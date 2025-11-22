-- ========================================
-- 將用戶設為管理員
-- ========================================
-- 
-- 使用方法：
-- 1. 在 Supabase Dashboard 的 SQL Editor 中執行
-- 2. 將 <USER_ID> 替換為實際的用戶 UUID
-- 3. 或者使用 auth.uid() 來將當前登入的用戶設為管理員
-- ========================================

-- 方法 1：將當前登入的用戶設為管理員
INSERT INTO public.admin_users (user_id) 
VALUES (auth.uid())
ON CONFLICT (user_id) DO NOTHING
RETURNING user_id, granted_at;

-- 方法 2：將特定用戶設為管理員（替換 <USER_ID>）
-- INSERT INTO public.admin_users (user_id) 
-- VALUES ('<USER_ID>'::uuid)
-- ON CONFLICT (user_id) DO NOTHING
-- RETURNING user_id, granted_at;

-- 驗證：檢查是否成功
SELECT 
  au.user_id,
  p.nickname,
  p.avatar,
  au.granted_at,
  p.created_at AS user_created_at
FROM public.admin_users au
LEFT JOIN public.profiles p ON p.id = au.user_id
WHERE au.user_id = COALESCE(auth.uid(), '<USER_ID>'::uuid);

