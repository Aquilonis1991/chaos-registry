-- ===============================================
-- 20251230 - 賦予 Google Play 審查帳號管理員權限
-- ===============================================

BEGIN;

-- 1. 確保 admin1@votechaos.app 存在於 admin_users 表中
-- 注意：此 SQL 假設該帳號已在 auth.users 建立。
-- 若尚未建立，此語句無效，請務必先手動註冊該帳號。

INSERT INTO public.admin_users (user_id, granted_by)
SELECT 
  id AS user_id,
  id AS granted_by  -- 自行授權 (或是指定一個現有的管理員ID)
FROM auth.users
WHERE email = 'admin1@votechaos.app'
ON CONFLICT (user_id) DO NOTHING;

-- 2. 驗證是否成功
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.admin_users au
    JOIN auth.users u ON u.id = au.user_id
    WHERE u.email = 'admin1@votechaos.app'
  ) THEN
    RAISE NOTICE '✅ admin1@votechaos.app 已成功升級為管理員';
  ELSE
    RAISE NOTICE '⚠️ admin1@votechaos.app 尚未成為管理員，請確認該 Email 是否已註冊';
  END IF;
END $$;

COMMIT;
