-- ========================================
-- 刷新 Schema Cache
-- 確保 PostgREST 重新載入資料庫 Schema
-- ========================================

-- 重要：執行此腳本後，請等待 10-30 秒讓 Schema Cache 更新

-- 方法 1：多次發送通知（推薦）
SELECT pg_notify('pgrst', 'reload schema');
SELECT pg_notify('pgrst', 'reload schema');
SELECT pg_notify('pgrst', 'reload schema');

-- 等待 1 秒後再次發送
DO $$
BEGIN
  PERFORM pg_sleep(1);
  PERFORM pg_notify('pgrst', 'reload schema');
  PERFORM pg_notify('pgrst', 'reload schema');
END $$;

-- 驗證通知是否發送成功
SELECT 
  'Schema Cache 刷新' as status,
  '已發送 5 次 pg_notify(''pgrst'', ''reload schema'') 通知' as message,
  '請等待 10-30 秒後刷新瀏覽器頁面' as next_step;

-- 驗證關鍵函數是否在 Schema 中
SELECT 
  '函數驗證' as category,
  p.proname as function_name,
  pg_get_function_arguments(p.oid) as arguments,
  CASE 
    WHEN p.proname IN (
      'handle_topic_report',
      'handle_user_report',
      'check_user_restriction',
      'admin_grant_tokens',
      'admin_grant_free_create',
      'get_user_stats'
    ) THEN '✓ 存在'
    ELSE '⚠️ 未找到'
  END as status
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
  AND p.proname IN (
    'handle_topic_report',
    'handle_user_report',
    'check_user_restriction',
    'admin_grant_tokens',
    'admin_grant_free_create',
    'get_user_stats',
    'is_admin'
  )
ORDER BY p.proname;

-- 驗證關鍵表是否在 Schema 中
SELECT 
  '表驗證' as category,
  table_name,
  CASE 
    WHEN table_name IN (
      'reports',
      'user_restrictions',
      'topics',
      'profiles'
    ) THEN '✓ 存在'
    ELSE '⚠️ 未找到'
  END as status
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN (
    'reports',
    'user_restrictions',
    'topics',
    'profiles'
  )
ORDER BY table_name;

