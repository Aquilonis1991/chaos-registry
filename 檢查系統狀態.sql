-- ========================================
-- 檢查系統狀態
-- 驗證所有必要的表、函數和政策是否正確設置
-- ========================================

-- 1. 檢查核心表是否存在
SELECT 
  '核心表檢查' as category,
  table_name,
  CASE 
    WHEN table_name IN ('profiles', 'topics', 'votes', 'free_votes', 'reports', 'user_restrictions') 
    THEN '✓ 已存在'
    ELSE '⚠️ 需要檢查'
  END as status
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN (
    'profiles',
    'topics',
    'votes',
    'free_votes',
    'free_create_qualifications',
    'reports',
    'user_restrictions',
    'token_transactions',
    'announcements',
    'system_config',
    'ui_texts',
    'admin_users',
    'daily_logins'
  )
ORDER BY table_name;

-- 2. 檢查 topics 表的必要欄位
SELECT 
  'topics 表欄位' as category,
  column_name,
  data_type,
  CASE 
    WHEN column_name IN ('is_hidden', 'hidden_by', 'hidden_at', 'hidden_reason', 'report_count', 'auto_hidden')
    THEN '✓ 已存在'
    ELSE '⚠️ 需要檢查'
  END as status
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'topics'
  AND column_name IN ('is_hidden', 'hidden_by', 'hidden_at', 'hidden_reason', 'report_count', 'auto_hidden')
ORDER BY column_name;

-- 3. 檢查關鍵函數是否存在
SELECT 
  '關鍵函數' as category,
  p.proname as function_name,
  CASE 
    WHEN p.proname IN (
      'handle_topic_report',
      'handle_user_report',
      'check_user_restriction',
      'admin_grant_tokens',
      'admin_grant_free_create',
      'get_user_stats',
      'hide_topic',
      'unhide_topic',
      'delete_topic_admin'
    )
    THEN '✓ 已存在'
    ELSE '⚠️ 需要檢查'
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
    'hide_topic',
    'unhide_topic',
    'delete_topic_admin',
    'is_admin'
  )
ORDER BY p.proname;

-- 4. 檢查 RLS 是否啟用
SELECT 
  'RLS 狀態' as category,
  tablename,
  CASE 
    WHEN rowsecurity THEN '✓ RLS 已啟用'
    ELSE '⚠️ RLS 未啟用'
  END as status
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN ('topics', 'reports', 'user_restrictions', 'profiles')
ORDER BY tablename;

-- 5. 檢查用戶限制表的 UNIQUE 約束
SELECT 
  '用戶限制表約束' as category,
  conname as constraint_name,
  CASE 
    WHEN conname LIKE '%user_restrictions%' THEN '✓ 約束存在'
    ELSE '⚠️ 需要檢查'
  END as status
FROM pg_constraint
WHERE conrelid = 'public.user_restrictions'::regclass
  AND contype = 'u';

-- 6. 檢查檢舉表的 UNIQUE 約束
SELECT 
  '檢舉表約束' as category,
  conname as constraint_name,
  CASE 
    WHEN conname LIKE '%reports%' THEN '✓ 約束存在'
    ELSE '⚠️ 需要檢查'
  END as status
FROM pg_constraint
WHERE conrelid = 'public.reports'::regclass
  AND contype = 'u';

-- 7. 統計數據
SELECT 
  '統計數據' as category,
  '用戶總數' as metric,
  COUNT(*)::text as value
FROM public.profiles
UNION ALL
SELECT 
  '統計數據',
  '主題總數',
  COUNT(*)::text
FROM public.topics
UNION ALL
SELECT 
  '統計數據',
  '活躍主題數',
  COUNT(*)::text
FROM public.topics
WHERE status = 'active' AND is_hidden = false
UNION ALL
SELECT 
  '統計數據',
  '檢舉記錄數',
  COUNT(*)::text
FROM public.reports
UNION ALL
SELECT 
  '統計數據',
  '用戶限制數',
  COUNT(*)::text
FROM public.user_restrictions
WHERE is_active = true;

-- 8. 檢查管理員帳號
SELECT 
  '管理員帳號' as category,
  COUNT(*)::text || ' 位管理員' as value
FROM public.admin_users;

-- 9. 檢查最近的檢舉記錄（最後 5 條）
SELECT 
  '最近檢舉' as category,
  target_type,
  status,
  created_at
FROM public.reports
ORDER BY created_at DESC
LIMIT 5;

-- 10. 刷新 Schema Cache（自動執行）
SELECT pg_notify('pgrst', 'reload schema');
SELECT pg_notify('pgrst', 'reload schema');
SELECT pg_notify('pgrst', 'reload schema');

-- 11. 檢查 Schema Cache 狀態提示
SELECT 
  '提示' as category,
  '已自動執行 Schema Cache 刷新，請等待 10-30 秒後刷新瀏覽器頁面' as message;

