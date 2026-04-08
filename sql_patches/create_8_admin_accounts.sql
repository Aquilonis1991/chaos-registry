-- =============================================================================
-- 建立 8 個「一般管理者」帳號（is_super_admin = false）
--
-- 步驟說明（與 20250108000000_add_admin_management_features.sql 相同做法）：
-- 1) 無法僅靠一般 SQL 在託管 Supabase 直接寫入 auth.users；請先建立使用者。
--    方式 A：Supabase Dashboard → Authentication → Users → Add user
--    方式 B：先執行下方 DO 區塊（會 RAISE NOTICE 印出 supabase CLI 指令），複製到終端機執行
-- 2) 八個帳號都建立完成後，再執行本檔案「INSERT INTO public.admin_users」區塊。
--
-- 密碼對照（請自行保管；正式環境建議建立後改密碼）：
-- | 帳號      | 電子郵件              | 密碼              | 權限       |
-- |-----------|----------------------|-------------------|------------|
-- | 管理員 1  | admin1@votechaos.app | AdminA7B9C2D4     | 一般管理者 |
-- | 管理員 2  | admin2@votechaos.app | AdminE5F8G1H3     | 一般管理者 |
-- | 管理員 3  | admin3@votechaos.app | AdminI6J0K4L7     | 一般管理者 |
-- | 管理員 4  | admin4@votechaos.app | AdminM2N5P8Q1     | 一般管理者 |
-- | 管理員 5  | admin5@votechaos.app | AdminR3T6V9W2     | 一般管理者 |
-- | 管理員 6  | admin6@votechaos.app | AdminX4Y7Z0A3     | 一般管理者 |
-- | 管理員 7  | admin7@votechaos.app | AdminB5C8D1E4     | 一般管理者 |
-- | 管理員 8  | admin8@votechaos.app | AdminF6G9H2J5     | 一般管理者 |
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 步驟一：僅用於印出建立使用者用的 CLI（密碼為上表固定值；須在本機已安裝 supabase CLI）
-- -----------------------------------------------------------------------------
DO $$
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE '請依序建立 8 位使用者（範例：supabase CLI）';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'supabase auth admin create-user --email admin1@votechaos.app --password AdminA7B9C2D4';
  RAISE NOTICE 'supabase auth admin create-user --email admin2@votechaos.app --password AdminE5F8G1H3';
  RAISE NOTICE 'supabase auth admin create-user --email admin3@votechaos.app --password AdminI6J0K4L7';
  RAISE NOTICE 'supabase auth admin create-user --email admin4@votechaos.app --password AdminM2N5P8Q1';
  RAISE NOTICE 'supabase auth admin create-user --email admin5@votechaos.app --password AdminR3T6V9W2';
  RAISE NOTICE 'supabase auth admin create-user --email admin6@votechaos.app --password AdminX4Y7Z0A3';
  RAISE NOTICE 'supabase auth admin create-user --email admin7@votechaos.app --password AdminB5C8D1E4';
  RAISE NOTICE 'supabase auth admin create-user --email admin8@votechaos.app --password AdminF6G9H2J5';
  RAISE NOTICE '========================================';
  RAISE NOTICE '建立完成後再執行本檔案下方的 INSERT INTO public.admin_users';
  RAISE NOTICE '========================================';
END $$;

-- -----------------------------------------------------------------------------
-- 步驟二：在 8 個 auth 使用者已存在後執行：授予一般管理員（is_super_admin = false）
-- 新列：插入為一般管理者。已存在列：僅解除 is_suspended，不變更 is_super_admin（避免誤降級最高管理者）
-- -----------------------------------------------------------------------------
INSERT INTO public.admin_users (user_id, is_super_admin)
SELECT u.id, false
FROM auth.users u
WHERE u.email IN (
  'admin1@votechaos.app',
  'admin2@votechaos.app',
  'admin3@votechaos.app',
  'admin4@votechaos.app',
  'admin5@votechaos.app',
  'admin6@votechaos.app',
  'admin7@votechaos.app',
  'admin8@votechaos.app'
)
ON CONFLICT (user_id) DO UPDATE
SET is_suspended = false;
