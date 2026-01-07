-- ==========================================
-- 資料庫完整診斷報告
-- 確認當前資料庫狀況以及其目前建構內容
-- 在 Supabase SQL Editor 執行
-- ==========================================

-- ==========================================
-- 第一部分：資料庫基本資訊
-- ==========================================
SELECT 
  '資料庫資訊' as section,
  current_database() as database_name,
  version() as postgresql_version,
  current_user as current_user,
  current_schema() as current_schema,
  now() as check_time;

-- ==========================================
-- 第二部分：所有資料表列表及行數統計
-- ==========================================
SELECT 
  '資料表列表' as section,
  schemaname as schema_name,
  tablename as table_name,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as total_size,
  pg_size_pretty(pg_relation_size(schemaname||'.'||tablename)) as table_size,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename) - pg_relation_size(schemaname||'.'||tablename)) as indexes_size,
  CASE 
    WHEN rowsecurity THEN '✓ RLS 已啟用'
    ELSE '✗ RLS 未啟用'
  END as rls_status
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;

-- 各表的行數統計（使用動態查詢會更準確，這裡提供主要表）
SELECT 
  '表行數統計' as section,
  'profiles' as table_name,
  COUNT(*)::bigint as row_count
FROM public.profiles
UNION ALL
SELECT 
  '表行數統計',
  'topics',
  COUNT(*)::bigint
FROM public.topics
UNION ALL
SELECT 
  '表行數統計',
  'votes',
  COUNT(*)::bigint
FROM public.votes
UNION ALL
SELECT 
  '表行數統計',
  'free_votes',
  COUNT(*)::bigint
FROM public.free_votes
UNION ALL
SELECT 
  '表行數統計',
  'reports',
  COUNT(*)::bigint
FROM public.reports
UNION ALL
SELECT 
  '表行數統計',
  'user_restrictions',
  COUNT(*)::bigint
FROM public.user_restrictions
UNION ALL
SELECT 
  '表行數統計',
  'token_transactions',
  COUNT(*)::bigint
FROM public.token_transactions
UNION ALL
SELECT 
  '表行數統計',
  'announcements',
  COUNT(*)::bigint
FROM public.announcements
UNION ALL
SELECT 
  '表行數統計',
  'system_config',
  COUNT(*)::bigint
FROM public.system_config
UNION ALL
SELECT 
  '表行數統計',
  'ui_texts',
  COUNT(*)::bigint
FROM public.ui_texts
UNION ALL
SELECT 
  '表行數統計',
  'admin_users',
  COUNT(*)::bigint
FROM public.admin_users
UNION ALL
SELECT 
  '表行數統計',
  'daily_logins',
  COUNT(*)::bigint
FROM public.daily_logins
UNION ALL
SELECT 
  '表行數統計',
  'free_create_qualifications',
  COUNT(*)::bigint
FROM public.free_create_qualifications
ORDER BY table_name;

-- ==========================================
-- 第三部分：資料表結構（欄位資訊）
-- ==========================================
SELECT 
  '表結構' as section,
  table_name,
  column_name,
  data_type,
  character_maximum_length,
  is_nullable,
  column_default,
  ordinal_position
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name IN (
    'profiles', 'topics', 'votes', 'free_votes', 'reports', 
    'user_restrictions', 'token_transactions', 'announcements',
    'system_config', 'ui_texts', 'admin_users', 'daily_logins',
    'free_create_qualifications'
  )
ORDER BY table_name, ordinal_position;

-- ==========================================
-- 第四部分：所有函數列表
-- ==========================================
SELECT 
  '函數列表' as section,
  n.nspname as schema_name,
  p.proname as function_name,
  pg_get_function_arguments(p.oid) as arguments,
  pg_get_function_result(p.oid) as return_type,
  CASE 
    WHEN p.provolatile = 'i' THEN 'IMMUTABLE'
    WHEN p.provolatile = 's' THEN 'STABLE'
    WHEN p.provolatile = 'v' THEN 'VOLATILE'
  END as volatility,
  CASE 
    WHEN p.prosecdef THEN 'SECURITY DEFINER'
    ELSE 'SECURITY INVOKER'
  END as security
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
ORDER BY p.proname;

-- ==========================================
-- 第五部分：觸發器列表
-- ==========================================
SELECT 
  '觸發器列表' as section,
  n.nspname as schema_name,
  t.tgname as trigger_name,
  c.relname as table_name,
  pg_get_triggerdef(t.oid) as trigger_definition
FROM pg_trigger t
JOIN pg_class c ON t.tgrelid = c.oid
JOIN pg_namespace n ON c.relnamespace = n.oid
WHERE n.nspname = 'public'
  AND NOT t.tgisinternal
ORDER BY c.relname, t.tgname;

-- ==========================================
-- 第六部分：索引資訊
-- ==========================================
SELECT 
  '索引列表' as section,
  schemaname as schema_name,
  tablename as table_name,
  indexname as index_name,
  indexdef as index_definition
FROM pg_indexes
WHERE schemaname = 'public'
ORDER BY tablename, indexname;

-- ==========================================
-- 第七部分：外鍵約束
-- ==========================================
SELECT 
  '外鍵約束' as section,
  tc.table_name as table_name,
  kcu.column_name as column_name,
  ccu.table_name AS foreign_table_name,
  ccu.column_name AS foreign_column_name,
  tc.constraint_name as constraint_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
  AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
  AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND tc.table_schema = 'public'
ORDER BY tc.table_name, tc.constraint_name;

-- ==========================================
-- 第八部分：唯一約束和主鍵
-- ==========================================
SELECT 
  '唯一約束與主鍵' as section,
  tc.table_name as table_name,
  tc.constraint_type as constraint_type,
  tc.constraint_name as constraint_name,
  kcu.column_name as column_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
  AND tc.table_schema = kcu.table_schema
WHERE tc.constraint_type IN ('PRIMARY KEY', 'UNIQUE')
  AND tc.table_schema = 'public'
ORDER BY tc.table_name, tc.constraint_type, tc.constraint_name;

-- ==========================================
-- 第九部分：RLS 政策
-- ==========================================
SELECT 
  'RLS 政策' as section,
  schemaname as schema_name,
  tablename as table_name,
  policyname as policy_name,
  permissive as permissive,
  roles as roles,
  cmd as command,
  qual as using_expression,
  with_check as with_check_expression
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;

-- ==========================================
-- 第十部分：枚舉類型
-- ==========================================
SELECT 
  '枚舉類型' as section,
  t.typname as enum_name,
  array_agg(e.enumlabel ORDER BY e.enumsortorder) as enum_values
FROM pg_type t
JOIN pg_enum e ON t.oid = e.enumtypid
JOIN pg_namespace n ON t.typnamespace = n.oid
WHERE n.nspname = 'public'
GROUP BY t.typname
ORDER BY t.typname;

-- ==========================================
-- 第十一部分：序列（Sequences）
-- ==========================================
SELECT 
  '序列列表' as section,
  schemaname as schema_name,
  sequencename as sequence_name,
  last_value,
  start_value,
  increment_by,
  max_value,
  min_value,
  cache_size
FROM pg_sequences
WHERE schemaname = 'public'
ORDER BY sequencename;

-- ==========================================
-- 第十二部分：視圖（Views）
-- ==========================================
SELECT 
  '視圖列表' as section,
  table_schema as schema_name,
  table_name as view_name,
  view_definition as definition
FROM information_schema.views
WHERE table_schema = 'public'
ORDER BY table_name;

-- ==========================================
-- 第十三部分：資料庫統計資訊
-- ==========================================
SELECT 
  '資料庫統計' as section,
  pg_size_pretty(pg_database_size(current_database())) as database_total_size,
  (SELECT COUNT(*) FROM pg_tables WHERE schemaname = 'public') as total_tables,
  (SELECT COUNT(*) FROM pg_proc p JOIN pg_namespace n ON p.pronamespace = n.oid WHERE n.nspname = 'public') as total_functions,
  (SELECT COUNT(*) FROM pg_indexes WHERE schemaname = 'public') as total_indexes,
  (SELECT COUNT(*) FROM pg_trigger t JOIN pg_class c ON t.tgrelid = c.oid JOIN pg_namespace n ON c.relnamespace = n.oid WHERE n.nspname = 'public' AND NOT t.tgisinternal) as total_triggers;

-- ==========================================
-- 第十四部分：關鍵功能檢查
-- ==========================================
SELECT 
  '關鍵功能檢查' as section,
  '每日簽到函數' as feature_name,
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM pg_proc p 
      JOIN pg_namespace n ON p.pronamespace = n.oid 
      WHERE n.nspname = 'public' 
      AND p.proname IN ('record_daily_login', 'check_daily_login_status', 'get_login_streak_info')
    ) THEN '✓ 已存在'
    ELSE '✗ 缺失'
  END as status
UNION ALL
SELECT 
  '關鍵功能檢查',
  '代幣交易函數',
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM pg_proc p 
      JOIN pg_namespace n ON p.pronamespace = n.oid 
      WHERE n.nspname = 'public' 
      AND p.proname LIKE '%token%'
    ) THEN '✓ 已存在'
    ELSE '✗ 缺失'
  END
UNION ALL
SELECT 
  '關鍵功能檢查',
  '管理員功能',
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM pg_proc p 
      JOIN pg_namespace n ON p.pronamespace = n.oid 
      WHERE n.nspname = 'public' 
      AND p.proname IN ('is_admin', 'admin_grant_tokens', 'admin_grant_free_create')
    ) THEN '✓ 已存在'
    ELSE '✗ 缺失'
  END
UNION ALL
SELECT 
  '關鍵功能檢查',
  '檢舉功能',
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM pg_proc p 
      JOIN pg_namespace n ON p.pronamespace = n.oid 
      WHERE n.nspname = 'public' 
      AND p.proname IN ('handle_topic_report', 'handle_user_report')
    ) THEN '✓ 已存在'
    ELSE '✗ 缺失'
  END;

-- ==========================================
-- 第十五部分：最近活動統計（最近 24 小時）
-- ==========================================
SELECT 
  '最近活動統計' as section,
  '最近 24 小時新增主題' as metric,
  COUNT(*)::text as value
FROM public.topics
WHERE created_at >= NOW() - INTERVAL '24 hours'
UNION ALL
SELECT 
  '最近活動統計',
  '最近 24 小時新增投票',
  COUNT(*)::text
FROM public.votes
WHERE created_at >= NOW() - INTERVAL '24 hours'
UNION ALL
SELECT 
  '最近活動統計',
  '最近 24 小時新增用戶',
  COUNT(*)::text
FROM public.profiles
WHERE created_at >= NOW() - INTERVAL '24 hours'
UNION ALL
SELECT 
  '最近活動統計',
  '最近 24 小時代幣交易',
  COUNT(*)::text
FROM public.token_transactions
WHERE created_at >= NOW() - INTERVAL '24 hours';

-- ==========================================
-- 完成提示
-- ==========================================
SELECT 
  '診斷完成' as section,
  '所有資料庫結構資訊已列出，請檢查上述各部分的結果' as message,
  now() as completed_at;

