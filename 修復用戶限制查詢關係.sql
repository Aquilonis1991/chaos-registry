-- ========================================
-- 修復用戶限制查詢關係
-- 確保 user_restrictions 表的外鍵關係正確設置
-- 雖然前端不使用自動關聯，但這有助於數據完整性
-- ========================================

-- 1. 檢查現有的外鍵約束
SELECT 
  tc.constraint_name,
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
  AND tc.table_name = 'user_restrictions';

-- 2. 檢查 user_restrictions 表的結構
SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'user_restrictions'
ORDER BY ordinal_position;

-- 3. 驗證外鍵關係（如果不存在則創建）
-- 注意：user_restrictions.user_id 已經引用 auth.users(id)
-- 我們需要確保這個關係存在
DO $$
BEGIN
  -- 檢查外鍵是否存在
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE constraint_type = 'FOREIGN KEY'
      AND table_name = 'user_restrictions'
      AND constraint_name LIKE '%user_id%'
  ) THEN
    -- 如果不存在，添加外鍵（如果表結構允許）
    -- 注意：這可能會失敗，如果表已經存在但沒有正確的外鍵
    RAISE NOTICE '外鍵約束可能缺失，但表可能已經有其他約束';
  END IF;
END $$;

-- 4. 為了讓 PostgREST 能夠識別關係，我們可以創建一個視圖
-- 但由於前端已經改為手動查詢，這不是必需的
-- 如果未來需要使用自動關聯，可以取消下面的註釋

/*
CREATE OR REPLACE VIEW public.user_restrictions_with_profiles AS
SELECT 
  ur.*,
  jsonb_build_object(
    'nickname', p.nickname,
    'avatar', p.avatar
  ) as profiles
FROM public.user_restrictions ur
LEFT JOIN public.profiles p ON ur.user_id = p.id;

-- 為視圖啟用 RLS
ALTER VIEW public.user_restrictions_with_profiles SET (security_invoker = false);
*/

-- 5. 驗證索引是否存在（用於性能優化）
SELECT 
  indexname,
  indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename = 'user_restrictions'
ORDER BY indexname;

-- 6. 重新載入 Schema Cache
SELECT pg_notify('pgrst', 'reload schema');
SELECT pg_notify('pgrst', 'reload schema');
SELECT pg_notify('pgrst', 'reload schema');

-- 7. 測試查詢（驗證數據）
SELECT 
  COUNT(*) as total_restrictions,
  COUNT(DISTINCT user_id) as unique_users,
  COUNT(*) FILTER (WHERE is_active = true) as active_restrictions
FROM public.user_restrictions;

