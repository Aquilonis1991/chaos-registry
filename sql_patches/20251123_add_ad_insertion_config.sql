-- ========================================
-- 20251123 - 添加廣告插入配置
-- ========================================
-- 此腳本添加首頁主題列表中穿插原生廣告的配置參數

-- 1. 廣告插入間隔（每 N 個主題插入 1 個廣告）
INSERT INTO public.system_config (key, value, category, description)
VALUES (
  'ad_insertion_interval',
  to_jsonb(10::integer),
  'advertising',
  '每 N 個主題插入 1 個原生廣告卡片（預設：10）'
)
ON CONFLICT (key) DO UPDATE
SET 
  value = EXCLUDED.value,
  category = EXCLUDED.category,
  description = EXCLUDED.description,
  updated_at = now();

-- 2. 首屏跳過主題數量（首屏不顯示廣告）
INSERT INTO public.system_config (key, value, category, description)
VALUES (
  'ad_insertion_skip_first',
  to_jsonb(10::integer),
  'advertising',
  '首屏不顯示廣告的主題數量（預設：10）'
)
ON CONFLICT (key) DO UPDATE
SET 
  value = EXCLUDED.value,
  category = EXCLUDED.category,
  description = EXCLUDED.description,
  updated_at = now();

-- 3. AdMob 原生廣告單元 ID
INSERT INTO public.system_config (key, value, category, description)
VALUES (
  'admob_native_ad_unit_id',
  to_jsonb('ca-app-pub-3940256099942544/2247696110'::text),
  'advertising',
  'AdMob 原生廣告單元 ID（測試 ID：ca-app-pub-3940256099942544/2247696110）'
)
ON CONFLICT (key) DO UPDATE
SET 
  value = EXCLUDED.value,
  category = EXCLUDED.category,
  description = EXCLUDED.description,
  updated_at = now();

-- 4. 廣告插入啟用狀態
INSERT INTO public.system_config (key, value, category, description)
VALUES (
  'ad_insertion_enabled',
  to_jsonb(true::boolean),
  'advertising',
  '是否啟用主題列表中穿插廣告功能（true/false）'
)
ON CONFLICT (key) DO UPDATE
SET 
  value = EXCLUDED.value,
  category = EXCLUDED.category,
  description = EXCLUDED.description,
  updated_at = now();

-- 驗證插入結果
SELECT 
  key,
  value,
  category,
  description,
  created_at,
  updated_at
FROM public.system_config
WHERE key IN (
  'ad_insertion_interval',
  'ad_insertion_skip_first',
  'admob_native_ad_unit_id',
  'ad_insertion_enabled'
)
ORDER BY key;

