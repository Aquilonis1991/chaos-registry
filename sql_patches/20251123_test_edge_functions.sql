-- ========================================
-- 測試 Edge Functions 是否正常運作
-- ========================================

-- 方法 1：直接檢查 system_config 資料表（確認 get-system-config 的資料來源）
-- 如果這個查詢成功，表示資料表存在，Edge Function 應該可以正常讀取
SELECT 
  key,
  value,
  category,
  description,
  updated_at
FROM system_config
ORDER BY key
LIMIT 10;

-- 方法 3：測試 http_post（處理 NULL 情況）
-- 如果 content 是 NULL，至少可以看到 status
SELECT 
  status,
  COALESCE(content::text, 'NULL - Function may require authentication or has an error') as response,
  CASE 
    WHEN status >= 200 AND status < 300 THEN 'Success'
    WHEN status = 401 THEN 'Unauthorized (Function exists but needs auth)'
    WHEN status = 403 THEN 'Forbidden'
    WHEN status >= 400 AND status < 500 THEN 'Client Error'
    WHEN status >= 500 THEN 'Server Error'
    WHEN status IS NULL THEN 'No response'
    ELSE 'Unknown'
  END AS status_category
FROM extensions.http_post(
  uri := 'https://epyykzxxglkjombvozhr.supabase.co/functions/v1/get-system-config',
  data := '{}'::jsonb
);

