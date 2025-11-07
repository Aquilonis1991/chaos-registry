-- ========================================
-- 強制刷新 Schema Cache
-- 多次發送通知確保 PostgREST 重新載入 Schema
-- ========================================

-- 方法 1：多次發送通知（推薦）
SELECT pg_notify('pgrst', 'reload schema');
SELECT pg_notify('pgrst', 'reload schema');
SELECT pg_notify('pgrst', 'reload schema');

-- 等待一小段時間後再次發送
DO $$
BEGIN
  PERFORM pg_sleep(1);
  PERFORM pg_notify('pgrst', 'reload schema');
END $$;

-- 方法 2：驗證函數是否可以被查詢
SELECT 
  p.proname as function_name,
  pg_get_function_arguments(p.oid) as arguments
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
  AND p.proname IN ('admin_grant_tokens', 'admin_grant_free_create', 'get_user_stats')
ORDER BY p.proname;

-- 方法 3：測試調用函數（如果需要的話）
-- 注意：這需要實際的參數值，僅供測試使用
-- SELECT * FROM public.admin_grant_tokens(
--   '00000000-0000-0000-0000-000000000000'::uuid,
--   100,
--   '00000000-0000-0000-0000-000000000000'::uuid,
--   '測試'
-- );

