-- ==========================================
-- 資料庫完整診斷報告（單一查詢版）
-- 所有資訊合併在一個查詢結果中
-- 在 Supabase SQL Editor 執行
-- ==========================================

SELECT 
  category,
  item,
  value
FROM (
  -- 1. 資料庫基本資訊
  SELECT 
    '1. 資料庫資訊' as category,
    '資料庫名稱' as item,
    current_database()::text as value,
    1 as sort_order
  UNION ALL
  SELECT 
    '1. 資料庫資訊',
    'PostgreSQL 版本',
    split_part(version(), ' ', 1) || ' ' || split_part(version(), ' ', 2) as value,
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
    '檢查時間',
    to_char(now(), 'YYYY-MM-DD HH24:MI:SS TZ') as value,
    4

  -- 2. 資料庫統計
  UNION ALL
  SELECT 
    '2. 資料庫統計',
    '資料庫總大小',
    pg_size_pretty(pg_database_size(current_database())),
    5
  UNION ALL
  SELECT 
    '2. 資料庫統計',
    '資料表總數',
    (SELECT COUNT(*)::text FROM pg_tables WHERE schemaname = 'public'),
    6
  UNION ALL
  SELECT 
    '2. 資料庫統計',
    '函數總數',
    (SELECT COUNT(*)::text FROM pg_proc p JOIN pg_namespace n ON p.pronamespace = n.oid WHERE n.nspname = 'public'),
    7
  UNION ALL
  SELECT 
    '2. 資料庫統計',
    '索引總數',
    (SELECT COUNT(*)::text FROM pg_indexes WHERE schemaname = 'public'),
    8
  UNION ALL
  SELECT 
    '2. 資料庫統計',
    '觸發器總數',
    (SELECT COUNT(*)::text FROM pg_trigger t JOIN pg_class c ON t.tgrelid = c.oid JOIN pg_namespace n ON c.relnamespace = n.oid WHERE n.nspname = 'public' AND NOT t.tgisinternal),
    9

  -- 3. 表行數統計
  UNION ALL
  SELECT 
    '3. 表行數統計',
    'profiles',
    COUNT(*)::text,
    10
  FROM public.profiles
  UNION ALL
  SELECT 
    '3. 表行數統計',
    'topics',
    COUNT(*)::text,
    11
  FROM public.topics
  UNION ALL
  SELECT 
    '3. 表行數統計',
    'votes',
    COUNT(*)::text,
    12
  FROM public.votes
  UNION ALL
  SELECT 
    '3. 表行數統計',
    'free_votes',
    COUNT(*)::text,
    13
  FROM public.free_votes
  UNION ALL
  SELECT 
    '3. 表行數統計',
    'reports',
    COUNT(*)::text,
    14
  FROM public.reports
  UNION ALL
  SELECT 
    '3. 表行數統計',
    'user_restrictions',
    COUNT(*)::text,
    15
  FROM public.user_restrictions
  UNION ALL
  SELECT 
    '3. 表行數統計',
    'token_transactions',
    COUNT(*)::text,
    16
  FROM public.token_transactions
  UNION ALL
  SELECT 
    '3. 表行數統計',
    'announcements',
    COUNT(*)::text,
    17
  FROM public.announcements
  UNION ALL
  SELECT 
    '3. 表行數統計',
    'system_config',
    COUNT(*)::text,
    18
  FROM public.system_config
  UNION ALL
  SELECT 
    '3. 表行數統計',
    'ui_texts',
    COUNT(*)::text,
    19
  FROM public.ui_texts
  UNION ALL
  SELECT 
    '3. 表行數統計',
    'admin_users',
    COUNT(*)::text,
    20
  FROM public.admin_users
  UNION ALL
  SELECT 
    '3. 表行數統計',
    'daily_logins',
    COUNT(*)::text,
    21
  FROM public.daily_logins
  UNION ALL
  SELECT 
    '3. 表行數統計',
    'free_create_qualifications',
    COUNT(*)::text,
    22
  FROM public.free_create_qualifications

  -- 4. 關鍵功能檢查
  UNION ALL
  SELECT 
    '4. 關鍵功能檢查',
    '每日簽到函數',
    CASE 
      WHEN EXISTS (
        SELECT 1 FROM pg_proc p 
        JOIN pg_namespace n ON p.pronamespace = n.oid 
        WHERE n.nspname = 'public' 
        AND p.proname IN ('record_daily_login', 'check_daily_login_status', 'get_login_streak_info')
      ) THEN '✓ 已存在'
      ELSE '✗ 缺失'
    END,
    23
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
    24
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
    25
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
    26

  -- 5. 最近活動統計（24小時）
  UNION ALL
  SELECT 
    '5. 最近活動統計（24小時）',
    '新增主題',
    COUNT(*)::text,
    27
  FROM public.topics
  WHERE created_at >= NOW() - INTERVAL '24 hours'
  UNION ALL
  SELECT 
    '5. 最近活動統計（24小時）',
    '新增投票',
    COUNT(*)::text,
    28
  FROM public.votes
  WHERE created_at >= NOW() - INTERVAL '24 hours'
  UNION ALL
  SELECT 
    '5. 最近活動統計（24小時）',
    '新增用戶',
    COUNT(*)::text,
    29
  FROM public.profiles
  WHERE created_at >= NOW() - INTERVAL '24 hours'
  UNION ALL
  SELECT 
    '5. 最近活動統計（24小時）',
    '代幣交易',
    COUNT(*)::text,
    30
  FROM public.token_transactions
  WHERE created_at >= NOW() - INTERVAL '24 hours'
) AS all_results
ORDER BY sort_order;


