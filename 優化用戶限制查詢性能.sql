-- ========================================
-- 優化用戶限制查詢性能
-- 添加索引以提高查詢速度
-- ========================================

-- 1. 檢查現有索引
SELECT 
  schemaname,
  tablename,
  indexname,
  indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename = 'user_restrictions'
ORDER BY indexname;

-- 2. 創建複合索引以優化常見查詢（如果不存在）
-- 優化：查詢所有活躍限制（is_active = true）
CREATE INDEX IF NOT EXISTS idx_user_restrictions_active_restricted_at 
ON public.user_restrictions(is_active, restricted_at DESC)
WHERE is_active = true;

-- 優化：查詢特定用戶的活躍限制
CREATE INDEX IF NOT EXISTS idx_user_restrictions_user_active 
ON public.user_restrictions(user_id, is_active, restricted_at DESC)
WHERE is_active = true;

-- 3. 分析表以更新統計信息
ANALYZE public.user_restrictions;

-- 4. 驗證索引
SELECT 
  '索引創建完成' as status,
  COUNT(*) as total_indexes
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename = 'user_restrictions'
  AND indexname LIKE 'idx_user_restrictions%';

-- 5. 重新載入 Schema Cache
SELECT pg_notify('pgrst', 'reload schema');
SELECT pg_notify('pgrst', 'reload schema');

