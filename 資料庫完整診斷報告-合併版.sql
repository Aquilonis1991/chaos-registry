-- ==========================================
-- 資料庫完整診斷報告（合併版）
-- 所有查詢結果合併顯示，方便一次查看
-- 在 Supabase SQL Editor 執行
-- ==========================================

-- 使用統一的結果格式，將所有診斷資訊合併顯示
WITH 
-- 資料庫基本資訊
db_info AS (
  SELECT 
    '1. 資料庫資訊' as category,
    '資料庫名稱' as item,
    current_database()::text as value,
    1 as sort_order
  UNION ALL
  SELECT 
    '1. 資料庫資訊',
    'PostgreSQL 版本',
    version(),
    2
  UNION ALL
  SELECT 
    '1. 資料庫資訊',
    '當前用戶',
    current_user::text,
    3
  UNION ALL
  SELECT 
    '1. 資料庫資訊',
    '當前 Schema',
    current_schema()::text,
    4
  UNION ALL
  SELECT 
    '1. 資料庫資訊',
    '檢查時間',
    now()::text,
    5
),

-- 資料庫統計
db_stats AS (
  SELECT 
    '2. 資料庫統計' as category,
    '資料庫總大小' as item,
    pg_size_pretty(pg_database_size(current_database())) as value,
    1 as sort_order
  UNION ALL
  SELECT 
    '2. 資料庫統計',
    '資料表總數',
    (SELECT COUNT(*)::text FROM pg_tables WHERE schemaname = 'public'),
    2
  UNION ALL
  SELECT 
    '2. 資料庫統計',
    '函數總數',
    (SELECT COUNT(*)::text FROM pg_proc p JOIN pg_namespace n ON p.pronamespace = n.oid WHERE n.nspname = 'public'),
    3
  UNION ALL
  SELECT 
    '2. 資料庫統計',
    '索引總數',
    (SELECT COUNT(*)::text FROM pg_indexes WHERE schemaname = 'public'),
    4
  UNION ALL
  SELECT 
    '2. 資料庫統計',
    '觸發器總數',
    (SELECT COUNT(*)::text FROM pg_trigger t JOIN pg_class c ON t.tgrelid = c.oid JOIN pg_namespace n ON c.relnamespace = n.oid WHERE n.nspname = 'public' AND NOT t.tgisinternal),
    5
),

-- 表行數統計
table_counts AS (
  SELECT 
    '3. 表行數統計' as category,
    'profiles' as item,
    COUNT(*)::text as value,
    1 as sort_order
  FROM public.profiles
  UNION ALL
  SELECT 
    '3. 表行數統計',
    'topics',
    COUNT(*)::text,
    2
  FROM public.topics
  UNION ALL
  SELECT 
    '3. 表行數統計',
    'votes',
    COUNT(*)::text,
    3
  FROM public.votes
  UNION ALL
  SELECT 
    '3. 表行數統計',
    'free_votes',
    COUNT(*)::text,
    4
  FROM public.free_votes
  UNION ALL
  SELECT 
    '3. 表行數統計',
    'reports',
    COUNT(*)::text,
    5
  FROM public.reports
  UNION ALL
  SELECT 
    '3. 表行數統計',
    'user_restrictions',
    COUNT(*)::text,
    6
  FROM public.user_restrictions
  UNION ALL
  SELECT 
    '3. 表行數統計',
    'token_transactions',
    COUNT(*)::text,
    7
  FROM public.token_transactions
  UNION ALL
  SELECT 
    '3. 表行數統計',
    'announcements',
    COUNT(*)::text,
    8
  FROM public.announcements
  UNION ALL
  SELECT 
    '3. 表行數統計',
    'system_config',
    COUNT(*)::text,
    9
  FROM public.system_config
  UNION ALL
  SELECT 
    '3. 表行數統計',
    'ui_texts',
    COUNT(*)::text,
    10
  FROM public.ui_texts
  UNION ALL
  SELECT 
    '3. 表行數統計',
    'admin_users',
    COUNT(*)::text,
    11
  FROM public.admin_users
  UNION ALL
  SELECT 
    '3. 表行數統計',
    'daily_logins',
    COUNT(*)::text,
    12
  FROM public.daily_logins
  UNION ALL
  SELECT 
    '3. 表行數統計',
    'free_create_qualifications',
    COUNT(*)::text,
    13
  FROM public.free_create_qualifications
),

-- 關鍵功能檢查
key_features AS (
  SELECT 
    '4. 關鍵功能檢查' as category,
    '每日簽到函數' as item,
    CASE 
      WHEN EXISTS (
        SELECT 1 FROM pg_proc p 
        JOIN pg_namespace n ON p.pronamespace = n.oid 
        WHERE n.nspname = 'public' 
        AND p.proname IN ('record_daily_login', 'check_daily_login_status', 'get_login_streak_info')
      ) THEN '✓ 已存在'
      ELSE '✗ 缺失'
    END as value,
    1 as sort_order
  UNION ALL
  SELECT 
    '4. 關鍵功能檢查',
    '代幣交易函數',
    CASE 
      WHEN EXISTS (
        SELECT 1 FROM pg_proc p 
        JOIN pg_namespace n ON p.pronamespace = n.oid 
        WHERE n.nspname = 'public' 
        AND p.proname LIKE '%token%'
      ) THEN '✓ 已存在'
      ELSE '✗ 缺失'
    END,
    2
  UNION ALL
  SELECT 
    '4. 關鍵功能檢查',
    '管理員功能',
    CASE 
      WHEN EXISTS (
        SELECT 1 FROM pg_proc p 
        JOIN pg_namespace n ON p.pronamespace = n.oid 
        WHERE n.nspname = 'public' 
        AND p.proname IN ('is_admin', 'admin_grant_tokens', 'admin_grant_free_create')
      ) THEN '✓ 已存在'
      ELSE '✗ 缺失'
    END,
    3
  UNION ALL
  SELECT 
    '4. 關鍵功能檢查',
    '檢舉功能',
    CASE 
      WHEN EXISTS (
        SELECT 1 FROM pg_proc p 
        JOIN pg_namespace n ON p.pronamespace = n.oid 
        WHERE n.nspname = 'public' 
        AND p.proname IN ('handle_topic_report', 'handle_user_report')
      ) THEN '✓ 已存在'
      ELSE '✗ 缺失'
    END,
    4
),

-- 最近活動統計
recent_activity AS (
  SELECT 
    '5. 最近活動統計（24小時）' as category,
    '新增主題' as item,
    COUNT(*)::text as value,
    1 as sort_order
  FROM public.topics
  WHERE created_at >= NOW() - INTERVAL '24 hours'
  UNION ALL
  SELECT 
    '5. 最近活動統計（24小時）',
    '新增投票',
    COUNT(*)::text,
    2
  FROM public.votes
  WHERE created_at >= NOW() - INTERVAL '24 hours'
  UNION ALL
  SELECT 
    '5. 最近活動統計（24小時）',
    '新增用戶',
    COUNT(*)::text,
    3
  FROM public.profiles
  WHERE created_at >= NOW() - INTERVAL '24 hours'
  UNION ALL
  SELECT 
    '5. 最近活動統計（24小時）',
    '代幣交易',
    COUNT(*)::text,
    4
  FROM public.token_transactions
  WHERE created_at >= NOW() - INTERVAL '24 hours'
)

-- 合併所有結果
SELECT category, item, value
FROM db_info
UNION ALL
SELECT category, item, value
FROM db_stats
UNION ALL
SELECT category, item, value
FROM table_counts
UNION ALL
SELECT category, item, value
FROM key_features
UNION ALL
SELECT category, item, value
FROM recent_activity
ORDER BY category, sort_order;

-- ==========================================
-- 詳細查詢（可分別執行查看詳細資訊）
-- ==========================================

-- 查詢 1: 所有資料表列表及大小
SELECT 
  '資料表列表' as section,
  tablename as table_name,
  pg_size_pretty(pg_total_relation_size('public.'||tablename)) as total_size,
  pg_size_pretty(pg_relation_size('public.'||tablename)) as table_size,
  CASE 
    WHEN rowsecurity THEN '✓ RLS 已啟用'
    ELSE '✗ RLS 未啟用'
  END as rls_status
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;

-- 查詢 2: 所有函數列表
SELECT 
  '函數列表' as section,
  p.proname as function_name,
  pg_get_function_arguments(p.oid) as arguments,
  pg_get_function_result(p.oid) as return_type
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
ORDER BY p.proname
LIMIT 50;  -- 限制顯示前 50 個函數

-- 查詢 3: RLS 政策列表
SELECT 
  'RLS 政策' as section,
  tablename as table_name,
  policyname as policy_name,
  cmd as command
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;

-- 查詢 4: 外鍵約束
SELECT 
  '外鍵約束' as section,
  tc.table_name,
  kcu.column_name,
  ccu.table_name AS foreign_table_name,
  ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
  AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
  AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND tc.table_schema = 'public'
ORDER BY tc.table_name;

-- 查詢 5: 枚舉類型
SELECT 
  '枚舉類型' as section,
  t.typname as enum_name,
  array_agg(e.enumlabel ORDER BY e.enumsortorder)::text as enum_values
FROM pg_type t
JOIN pg_enum e ON t.oid = e.enumtypid
JOIN pg_namespace n ON t.typnamespace = n.oid
WHERE n.nspname = 'public'
GROUP BY t.typname
ORDER BY t.typname;


