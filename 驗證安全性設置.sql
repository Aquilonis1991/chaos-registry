-- ==========================================
-- 驗證安全性設置是否正確
-- 在 Supabase SQL Editor 執行
-- ==========================================

-- 1. 檢查安全函數是否存在
SELECT 
  '安全函數檢查' as section,
  proname as function_name,
  prorettype::regtype as return_type,
  pg_get_function_arguments(oid) as arguments
FROM pg_proc
WHERE pronamespace = 'public'::regnamespace
  AND proname IN ('increment_option_votes', 'increment_free_vote', 'warn_direct_options_update')
ORDER BY proname;

-- 2. 檢查觸發器是否存在
SELECT 
  '觸發器檢查' as section,
  tgname as trigger_name,
  tgrelid::regclass as table_name,
  tgtype::text as trigger_type,
  pg_get_triggerdef(oid) as trigger_definition
FROM pg_trigger
WHERE tgrelid = 'public.topics'::regclass
  AND tgname = 'topics_options_update_warning';

-- 3. 檢查 topics 的 UPDATE 政策
SELECT 
  'Topics UPDATE 政策' as section,
  policyname,
  cmd,
  qual as using_clause,
  with_check as with_check_clause
FROM pg_policies
WHERE tablename = 'topics'
  AND cmd = 'UPDATE';

-- 4. 測試安全函數（需要實際的主題 ID，這裡只是檢查函數定義）
SELECT 
  '函數定義' as section,
  pg_get_functiondef(oid) as function_definition
FROM pg_proc
WHERE pronamespace = 'public'::regnamespace
  AND proname = 'increment_option_votes'
LIMIT 1;

-- 5. 總結
SELECT 
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM pg_proc 
      WHERE proname = 'increment_option_votes' 
      AND pronamespace = 'public'::regnamespace
    ) THEN '✅ increment_option_votes 函數存在'
    ELSE '❌ increment_option_votes 函數不存在'
  END as function_status_1,
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM pg_proc 
      WHERE proname = 'increment_free_vote' 
      AND pronamespace = 'public'::regnamespace
    ) THEN '✅ increment_free_vote 函數存在'
    ELSE '❌ increment_free_vote 函數不存在'
  END as function_status_2,
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM pg_trigger 
      WHERE tgname = 'topics_options_update_warning'
      AND tgrelid = 'public.topics'::regclass
    ) THEN '✅ 警告觸發器存在'
    ELSE '❌ 警告觸發器不存在'
  END as trigger_status;

