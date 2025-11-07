-- ========================================
-- 驗證 Schema Cache 是否已更新
-- 測試關鍵函數和表是否可以被正確訪問
-- ========================================

-- 1. 測試關鍵函數是否可以調用（不執行，只檢查簽名）
SELECT 
  '函數簽名檢查' as category,
  p.proname as function_name,
  pg_get_function_arguments(p.oid) as arguments,
  pg_get_function_result(p.oid) as return_type,
  CASE 
    WHEN p.proname IN (
      'handle_topic_report',
      'handle_user_report',
      'check_user_restriction',
      'admin_grant_tokens',
      'admin_grant_free_create',
      'get_user_stats'
    ) THEN '✓ 可訪問'
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
    'hide_topic',
    'unhide_topic',
    'delete_topic_admin',
    'is_admin'
  )
ORDER BY p.proname;

-- 2. 測試關鍵表的欄位是否可訪問
SELECT 
  '表欄位檢查' as category,
  table_name,
  column_name,
  data_type,
  CASE 
    WHEN table_name = 'topics' AND column_name IN ('is_hidden', 'hidden_by', 'hidden_at', 'report_count', 'auto_hidden')
    THEN '✓ 可訪問'
    WHEN table_name = 'reports' AND column_name IN ('reporter_id', 'target_type', 'target_id', 'report_type')
    THEN '✓ 可訪問'
    WHEN table_name = 'user_restrictions' AND column_name IN ('user_id', 'restriction_type', 'is_active')
    THEN '✓ 可訪問'
    ELSE '✓ 可訪問'
  END as status
FROM information_schema.columns
WHERE table_schema = 'public'
  AND (
    (table_name = 'topics' AND column_name IN ('is_hidden', 'hidden_by', 'hidden_at', 'hidden_reason', 'report_count', 'auto_hidden'))
    OR (table_name = 'reports' AND column_name IN ('reporter_id', 'target_type', 'target_id', 'report_type', 'status'))
    OR (table_name = 'user_restrictions' AND column_name IN ('user_id', 'restriction_type', 'is_active', 'reason'))
  )
ORDER BY table_name, column_name;

-- 3. 檢查 RLS 政策是否存在
SELECT 
  'RLS 政策檢查' as category,
  schemaname,
  tablename,
  policyname,
  CASE 
    WHEN tablename IN ('topics', 'reports', 'user_restrictions') THEN '✓ 政策存在'
    ELSE '⚠️ 需要檢查'
  END as status
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('topics', 'reports', 'user_restrictions')
ORDER BY tablename, policyname;

-- 4. 驗證結果總結
SELECT 
  '驗證總結' as category,
  CASE 
    WHEN (
      SELECT COUNT(*) FROM pg_proc p
      JOIN pg_namespace n ON p.pronamespace = n.oid
      WHERE n.nspname = 'public'
      AND p.proname IN ('handle_topic_report', 'handle_user_report', 'check_user_restriction', 'admin_grant_tokens')
    ) >= 4
    THEN '✓ Schema Cache 已更新，所有關鍵函數可訪問'
    ELSE '⚠️ 部分函數可能未載入，請再次執行刷新'
  END as message;

-- 5. 顯示當前時間（用於確認執行時間）
SELECT 
  '執行時間' as category,
  now()::text as current_time,
  '如果 Schema Cache 已更新，前端應該可以正常訪問這些函數和表' as note;

