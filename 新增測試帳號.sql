-- ========================================
-- 新增測試帳號
-- 帳號密碼相同：TEST01, TEST02
-- ========================================

-- 注意：Supabase 的用戶創建需要使用 Admin API 或正確的密碼哈希
-- 此腳本提供兩種方法

-- ========================================
-- 方法 1：使用 Supabase Admin API（推薦）
-- ========================================
-- 請在 Supabase Dashboard > Authentication > Users 中手動創建
-- 或使用以下資訊：
-- 帳號 1：TEST01@test.com / TEST01
-- 帳號 2：TEST02@test.com / TEST02

-- ========================================
-- 方法 2：使用 SQL 創建（需要管理員權限）
-- ========================================

-- 確保 pgcrypto 擴展已啟用（用於密碼加密）
CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$
DECLARE
  v_user_id_1 UUID;
  v_user_id_2 UUID;
  v_password_hash_1 TEXT;
  v_password_hash_2 TEXT;
BEGIN
  -- 生成密碼哈希（使用 bcrypt，Supabase 標準格式）
  -- 注意：Supabase 實際使用的哈希格式可能不同，建議使用方法 1
  
  -- 創建 TEST01 用戶
  SELECT id INTO v_user_id_1
  FROM auth.users
  WHERE email = 'TEST01@test.com';
  
  IF v_user_id_1 IS NULL THEN
    -- 生成 UUID
    v_user_id_1 := gen_random_uuid();
    
    -- 插入 auth.users
    INSERT INTO auth.users (
      instance_id,
      id,
      aud,
      role,
      email,
      encrypted_password,
      email_confirmed_at,
      raw_user_meta_data,
      created_at,
      updated_at,
      confirmation_token,
      email_change,
      email_change_token_new,
      recovery_token,
      is_super_admin
    )
    VALUES (
      '00000000-0000-0000-0000-000000000000',
      v_user_id_1,
      'authenticated',
      'authenticated',
      'TEST01@test.com',
      crypt('TEST01', gen_salt('bf')), -- bcrypt 加密
      now(),
      jsonb_build_object('username', 'TEST01', 'full_name', '測試帳號 01'),
      now(),
      now(),
      '',
      '',
      '',
      '',
      false
    );
    
    -- 創建對應的 profile（如果表存在）
    INSERT INTO public.profiles (id, nickname, tokens)
    VALUES (v_user_id_1, 'TEST01', 1000)
    ON CONFLICT (id) DO UPDATE
    SET nickname = 'TEST01';
    
    RAISE NOTICE '測試帳號 TEST01 創建成功';
    RAISE NOTICE '  帳號：TEST01@test.com';
    RAISE NOTICE '  密碼：TEST01';
    RAISE NOTICE '  用戶 ID：%', v_user_id_1;
  ELSE
    RAISE NOTICE '測試帳號 TEST01 已存在，用戶 ID：%', v_user_id_1;
  END IF;
  
  -- 創建 TEST02 用戶
  SELECT id INTO v_user_id_2
  FROM auth.users
  WHERE email = 'TEST02@test.com';
  
  IF v_user_id_2 IS NULL THEN
    -- 生成 UUID
    v_user_id_2 := gen_random_uuid();
    
    INSERT INTO auth.users (
      instance_id,
      id,
      aud,
      role,
      email,
      encrypted_password,
      email_confirmed_at,
      raw_user_meta_data,
      created_at,
      updated_at,
      confirmation_token,
      email_change,
      email_change_token_new,
      recovery_token,
      is_super_admin
    )
    VALUES (
      '00000000-0000-0000-0000-000000000000',
      v_user_id_2,
      'authenticated',
      'authenticated',
      'TEST02@test.com',
      crypt('TEST02', gen_salt('bf')), -- bcrypt 加密
      now(),
      jsonb_build_object('username', 'TEST02', 'full_name', '測試帳號 02'),
      now(),
      now(),
      '',
      '',
      '',
      '',
      false
    );
    
    -- 創建對應的 profile（如果表存在）
    INSERT INTO public.profiles (id, nickname, tokens)
    VALUES (v_user_id_2, 'TEST02', 1000)
    ON CONFLICT (id) DO UPDATE
    SET nickname = 'TEST02';
    
    RAISE NOTICE '測試帳號 TEST02 創建成功';
    RAISE NOTICE '  帳號：TEST02@test.com';
    RAISE NOTICE '  密碼：TEST02';
    RAISE NOTICE '  用戶 ID：%', v_user_id_2;
  ELSE
    RAISE NOTICE '測試帳號 TEST02 已存在，用戶 ID：%', v_user_id_2;
  END IF;
  
EXCEPTION
  WHEN insufficient_privilege THEN
    RAISE EXCEPTION '權限不足：無法直接插入 auth.users 表。請使用方法 1 在 Supabase Dashboard 中創建用戶，或使用 Supabase Admin API。';
  WHEN OTHERS THEN
    RAISE EXCEPTION '創建測試帳號時發生錯誤：%', SQLERRM;
END $$;

-- 驗證創建的帳號
SELECT 
  u.id,
  u.email,
  u.raw_user_meta_data->>'username' as username,
  u.email_confirmed_at,
  p.nickname,
  p.tokens,
  CASE 
    WHEN u.email_confirmed_at IS NOT NULL THEN '已確認'
    ELSE '未確認'
  END as status
FROM auth.users u
LEFT JOIN public.profiles p ON u.id = p.id
WHERE u.email IN ('TEST01@test.com', 'TEST02@test.com')
ORDER BY u.email;

-- ========================================
-- 使用說明
-- ========================================
-- 如果 SQL 方法失敗，請使用以下方式創建測試帳號：
--
-- 1. 在 Supabase Dashboard > Authentication > Users
-- 2. 點擊 "Add user" > "Create new user"
-- 3. 輸入：
--    - Email: TEST01@test.com
--    - Password: TEST01
--    - Auto Confirm User: 是
-- 4. 重複步驟 2-3 創建 TEST02@test.com / TEST02
--
-- 或者使用 Supabase CLI：
-- supabase auth admin create-user --email TEST01@test.com --password TEST01
-- supabase auth admin create-user --email TEST02@test.com --password TEST02

