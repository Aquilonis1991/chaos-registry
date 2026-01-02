-- ==========================================
-- 建立 Google Reviewer 測試帳號
-- ==========================================

BEGIN;

-- 1. 確保 auth.users 有此帳號
-- 注意: 密碼需要是加密後的 hash，這裡我們無法直接設明碼，
-- 建議您在 App 端手動註冊此帳號，或者使用 Supabase Dashboard 建立。
-- 帳號: google_reviewer@test.com
-- 密碼: Reviewer123!

-- 但為了方便 SQL 執行，我們可以直接檢查是否存在，不存在則提示
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE email = 'google_reviewer@test.com') THEN
    RAISE NOTICE '請手動在 Supabase Dashboard 建立帳號: google_reviewer@test.com / Reviewer123!';
  ELSE
    RAISE NOTICE '測試帳號已存在: google_reviewer@test.com';
  END IF;
END $$;

-- 2. 確保該帳號有足夠的代幣測試 (可選)
UPDATE public.profiles
SET tokens = 50000
WHERE id = (SELECT id FROM auth.users WHERE email = 'google_reviewer@test.com');

COMMIT;
