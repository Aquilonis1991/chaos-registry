-- ========================================
-- 修復用戶限制檢查函數
-- 確保 check_user_restriction 函數存在並刷新 Schema Cache
-- ========================================

-- 1. 刪除舊函數（如果存在）
DROP FUNCTION IF EXISTS public.check_user_restriction(uuid, text);
DROP FUNCTION IF EXISTS public.check_user_restriction(text, uuid);

-- 2. 重新創建函數：檢查用戶功能限制
CREATE OR REPLACE FUNCTION public.check_user_restriction(
  p_user_id UUID,
  p_restriction_type TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_restricted BOOLEAN := false;
BEGIN
  -- 檢查是否存在活躍的限制
  SELECT EXISTS (
    SELECT 1
    FROM public.user_restrictions
    WHERE user_id = p_user_id
      AND restriction_type = p_restriction_type
      AND is_active = true
      AND (expires_at IS NULL OR expires_at > now())
  ) INTO v_restricted;

  RETURN v_restricted;
END;
$$;

-- 3. 驗證函數是否存在
SELECT 
  proname as function_name,
  pg_get_function_arguments(oid) as arguments,
  pg_get_function_result(oid) as return_type
FROM pg_proc
WHERE proname = 'check_user_restriction' 
  AND pg_function_is_visible(oid)
ORDER BY proname;

-- 4. 測試函數（使用一個測試用戶 ID，請替換為實際的用戶 ID）
-- SELECT public.check_user_restriction(
--   '00000000-0000-0000-0000-000000000000'::UUID,
--   'vote'::TEXT
-- ) as test_result;

-- 5. 驗證 user_restrictions 表是否存在
SELECT 
  table_name,
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'user_restrictions'
ORDER BY ordinal_position;

-- 6. 檢查現有的限制記錄（用於調試）
SELECT 
  id,
  user_id,
  restriction_type,
  is_active,
  reason,
  expires_at,
  restricted_at
FROM public.user_restrictions
WHERE is_active = true
ORDER BY restricted_at DESC
LIMIT 10;

-- 7. 重新載入 Schema Cache（多次確保生效）
SELECT pg_notify('pgrst', 'reload schema');
SELECT pg_notify('pgrst', 'reload schema');
SELECT pg_notify('pgrst', 'reload schema');

-- 8. 等待一小段時間後再次發送
DO $$
BEGIN
  PERFORM pg_sleep(1);
  PERFORM pg_notify('pgrst', 'reload schema');
END $$;

-- 9. 提示信息
SELECT 
  '提示' as category,
  '已創建 check_user_restriction 函數並刷新 Schema Cache，請等待 10-30 秒後刷新瀏覽器頁面' as message;

