-- ========================================
-- 20251122 - 更新廣告插入配置為測試值
-- ========================================
-- 此腳本將廣告插入配置更新為測試值，方便測試廣告顯示

-- 1. 啟用廣告插入功能
UPDATE public.system_config 
SET 
  value = to_jsonb(true::boolean),
  updated_at = now()
WHERE key = 'ad_insertion_enabled';

-- 2. 更新廣告插入間隔為 5（測試值）
UPDATE public.system_config 
SET 
  value = to_jsonb(5::integer),
  updated_at = now()
WHERE key = 'ad_insertion_interval';

-- 3. 更新首屏跳過數量為 2（測試值）
UPDATE public.system_config 
SET 
  value = to_jsonb(2::integer),
  updated_at = now()
WHERE key = 'ad_insertion_skip_first';

-- 驗證更新結果
SELECT 
  key,
  value,
  updated_at
FROM public.system_config
WHERE key IN (
  'ad_insertion_enabled',
  'ad_insertion_interval',
  'ad_insertion_skip_first',
  'admob_native_ad_unit_id'
)
ORDER BY key;

